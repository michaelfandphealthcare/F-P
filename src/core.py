"""Transparent baseline detector for the ScamShield research prototype.

This module intentionally avoids hidden external services. It provides a small,
reproducible TF-IDF-style linear classifier plus a human-readable explanation
layer. It is a baseline for later model comparisons, not a production security
system.
"""

from __future__ import annotations

import csv
import json
import math
import re
from collections import Counter
from pathlib import Path
from typing import Iterable

import numpy as np

TOKEN_RE = re.compile(r"[a-zA-Z][a-zA-Z0-9']{1,}")

SIGNALS = [
    ("urgency", re.compile(r"\b(urgent|immediately|today|now|final warning|within \d+ hours|act now)\b", re.I), "The message creates pressure to act quickly."),
    ("credentials", re.compile(r"\b(password|passcode|one[- ]time code|login|sign in|verify your details|account details)\b", re.I), "The message asks for account or security information."),
    ("payment", re.compile(r"\b(pay|payment|card details|bank details|refund|fee|cash reward|prize|subscription)\b", re.I), "The message involves money, payment or a reward."),
    ("link", re.compile(r"\b(link|click|open|website|url|attached document)\b", re.I), "The message directs the reader to an external link or attachment."),
    ("impersonation", re.compile(r"\b(bank|government|tax|university|support team|delivery|parcel|school)\b", re.I), "The message refers to a trusted organisation or service."),
]


def tokenise(text: str) -> list[str]:
    return [t.lower() for t in TOKEN_RE.findall(text)]


def load_rows(path: str | Path) -> list[dict[str, str]]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


class ScamShieldModel:
    def __init__(self, max_features: int = 900):
        self.max_features = max_features
        self.vocabulary: dict[str, int] = {}
        self.idf: list[float] = []
        self.weights: list[float] = []
        self.bias = 0.0

    def _features(self, texts: Iterable[str], fit: bool = False) -> np.ndarray:
        tokenised = [tokenise(t) for t in texts]
        if fit:
            df = Counter()
            for tokens in tokenised:
                df.update(set(tokens))
            ranked = sorted(df.items(), key=lambda x: (-x[1], x[0]))[: self.max_features]
            self.vocabulary = {word: i for i, (word, _) in enumerate(ranked)}
            n = max(1, len(tokenised))
            self.idf = [math.log((1 + n) / (1 + df[word])) + 1 for word, _ in ranked]
        X = np.zeros((len(tokenised), len(self.vocabulary)), dtype=float)
        for row_i, tokens in enumerate(tokenised):
            counts = Counter(tokens)
            for word, count in counts.items():
                if word in self.vocabulary:
                    j = self.vocabulary[word]
                    X[row_i, j] = (1 + math.log(count)) * self.idf[j]
            norm = np.linalg.norm(X[row_i])
            if norm:
                X[row_i] /= norm
        return X

    @staticmethod
    def _sigmoid(z: np.ndarray) -> np.ndarray:
        z = np.clip(z, -30, 30)
        return 1 / (1 + np.exp(-z))

    def fit(self, texts: list[str], labels: list[int], epochs: int = 700, learning_rate: float = 0.18, l2: float = 0.02) -> "ScamShieldModel":
        X = self._features(texts, fit=True)
        y = np.asarray(labels, dtype=float)
        self.weights = [0.0] * X.shape[1]
        self.bias = 0.0
        w = np.zeros(X.shape[1], dtype=float)
        b = 0.0
        for _ in range(epochs):
            p = self._sigmoid(X @ w + b)
            error = p - y
            w -= learning_rate * ((X.T @ error) / len(y) + l2 * w)
            b -= learning_rate * float(np.mean(error))
        self.weights = w.tolist()
        self.bias = float(b)
        return self

    def predict_probability(self, text: str) -> float:
        X = self._features([text])
        return float(self._sigmoid(X @ np.asarray(self.weights) + self.bias)[0])

    def top_contributors(self, text: str, limit: int = 5) -> list[tuple[str, float]]:
        tokens = Counter(tokenise(text))
        scored = []
        for word, count in tokens.items():
            if word in self.vocabulary:
                j = self.vocabulary[word]
                value = (1 + math.log(count)) * self.idf[j] * self.weights[j]
                scored.append((word, float(value)))
        return sorted(scored, key=lambda x: abs(x[1]), reverse=True)[:limit]

    def to_json(self) -> dict:
        return {"vocabulary": self.vocabulary, "idf": self.idf, "weights": self.weights, "bias": self.bias}

    @classmethod
    def from_json(cls, payload: dict) -> "ScamShieldModel":
        model = cls()
        model.vocabulary = {str(k): int(v) for k, v in payload["vocabulary"].items()}
        model.idf = [float(v) for v in payload["idf"]]
        model.weights = [float(v) for v in payload["weights"]]
        model.bias = float(payload["bias"])
        return model


def explain(text: str, probability: float, model: ScamShieldModel) -> dict:
    reasons = []
    matched = []
    lower = text.lower()
    for key, pattern, message in SIGNALS:
        if pattern.search(text):
            matched.append(key)
            reasons.append(message)
    contributors = model.top_contributors(text)
    if not reasons:
        positive = [w for w, score in contributors if score > 0]
        if positive:
            reasons.append("The wording shares patterns with examples seen during training: " + ", ".join(positive[:3]) + ".")
    if not reasons:
        reasons.append("No strong warning pattern was found, but this is not proof that the message is safe.")
    if probability >= 0.70:
        label, band = "Suspicious", "High caution"
        action = "Do not click links or share information. Verify the request through the organisation's official website or a trusted contact route."
    elif probability >= 0.45:
        label, band = "Needs caution", "Uncertain"
        action = "Pause before acting. Check the sender and verify the request independently."
    else:
        label, band = "Likely legitimate", "Lower caution"
        action = "Continue to be careful. Do not share sensitive information unless you have independently verified the request."
    return {"label": label, "band": band, "probability": round(probability, 3), "reasons": reasons[:4], "signals": matched, "action": action}


def train_from_csv(path: str | Path) -> ScamShieldModel:
    rows = load_rows(path)
    texts = [r["text"] for r in rows]
    labels = [1 if r["label"].strip().lower() == "phishing" else 0 for r in rows]
    return ScamShieldModel().fit(texts, labels)


def save_model(model: ScamShieldModel, path: str | Path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(model.to_json(), f, indent=2)


def load_or_train(model_path: str | Path, data_path: str | Path) -> ScamShieldModel:
    if Path(model_path).exists():
        with open(model_path, encoding="utf-8") as f:
            return ScamShieldModel.from_json(json.load(f))
    model = train_from_csv(data_path)
    save_model(model, model_path)
    return model
