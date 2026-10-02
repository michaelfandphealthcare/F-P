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

NEGATED_SECURITY = re.compile(
    r"\b(never|do not|don't|dont|avoid|remember not to|should not)\s+(?:ever\s+)?"
    r"(?:share|send|give|enter|type|provide|disclose|click)\b[^.?!]{0,70}\b"
    r"(?:password|passcode|one[- ]time code|otp|security code|login)\b", re.I
)
EDUCATIONAL_CONTEXT = re.compile(r"\b(awareness|security advice|example of (?:a )?scam|spot (?:a )?scam|protect yourself|phishing is|scammers? may)\b", re.I)
PROTECTIVE_ADVICE = re.compile(
    r"\b(?:never|do not|don't|dont|avoid|remember|be careful|stay safe|report)\b"
    r"[^.?!]{0,140}\b(?:password|passcode|code|otp|link|bank|account|payment|sender|scam|details)\b",
    re.I,
)
AUTH_CODE_REQUEST = re.compile(
    r"\b(?:reply|send|share|tell|give|provide|forward|enter|type|confirm|verify|approve|authori[sz]e)\b"
    r"[^.?!]{0,100}\b(?:six[- ]digit|\d[- ]digit|security|verification|authentication|one[- ]time|otp|passcode|access|login)"
    r"\s*(?:code|number|approval|request|token)?\b",
    re.I,
)
SUPPORT_IMPERSONATION = re.compile(
    r"\b(?:it|technical|account|customer|service|help)\s*(?:support|helpdesk|desk|team)\b"
    r"|\b(?:helpdesk|support desk|support team|technical support)\b",
    re.I,
)

SIGNAL_RULES = [
    ("urgency", re.compile(r"\b(urgent(?:ly)?|immediately|act now|final warning|today|within\s+\d+\s*(?:minutes?|hours?)|expires?\s+(?:today|soon)|before\s+\d+\s*(?:minutes?|hours?))\b", re.I), "The message uses a time limit or pressure to make a quick decision more likely."),
    ("credentials", re.compile(r"\b(?:send|share|enter|provide|confirm|verify|update|reset|submit|type|need|needs|require|required|requires)\b[^.?!]{0,80}\b(password|passcode|one[- ]time code|otp|security code|login details|sign[- ]in details)\b|\b(password|passcode|one[- ]time code|otp|security code)\b[^.?!]{0,50}\b(?:required|needed|confirm|verify|send|share|enter|now|immediately)\b", re.I), "It asks for a password, one-time code or other security credential."),
    ("payment", re.compile(r"\b(?:pay|send|transfer|authori[sz]e|settle|confirm)\b[^.?!]{0,90}(?:£\s?\d[\d,.]*|\$\s?\d[\d,.]*|€\s?\d[\d,.]*|payment|bank details|card details|account number|fee|charge)|(?:£\s?\d[\d,.]*|\$\s?\d[\d,.]*|€\s?\d[\d,.]*)[^.?!]{0,70}\b(?:send|pay|transfer|urgent|now|today|account)\b|\b(?:payment|bank details|card details|fee|charge)\b[^.?!]{0,50}\b(?:required|needed|confirm|pay|send|update)\b", re.I), "It requests or pressures the reader to make a payment or disclose payment details."),
    ("link", re.compile(r"(?:https?://|www\.)\S+|\b(?:click|tap|open|scan|follow)\b[^.?!]{0,45}\b(?:link|url|qr|code|button|website|portal)\b|\b(?:at|using|via|through)\s+(?:this\s+)?(?:link|url|website|portal)\b", re.I), "It directs the reader to a link, QR code or external destination."),
    ("impersonation", re.compile(r"\b(?:your\s+)?(?:bank|banking|tax office|hmrc|university|student account|nhs|health service|hospital|delivery company|parcel service|football club|ticket office|support team)\b[^.?!]{0,90}\b(?:verify|confirm|pay|send|sign|login|log in|click|open|update|claim|secure|avoid)\b|\b(?:verify|confirm|pay|send|sign|login|log in|click|open|update|claim|secure|avoid)\b[^.?!]{0,90}\b(?:bank|banking|tax office|hmrc|university|student account|nhs|health service|hospital|delivery company|parcel service|football club|ticket office|support team)\b", re.I), "It combines a trusted-service identity with a request or action."),
    ("family_impersonation", re.compile(r"\b(?:mum|mom|dad|son|daughter|brother|sister|family|friend)\b[^.?!]{0,100}\b(?:send|transfer|lend|pay|money|£\s?\d|bank)\b|\b(?:send|transfer|lend|pay)\b[^.?!]{0,70}\b(?:mum|mom|dad|son|daughter|brother|sister|family|friend)\b", re.I), "It resembles a family or friend impersonation request involving money."),
    ("authentication_code", AUTH_CODE_REQUEST, "It asks the reader to disclose or enter an authentication code, approval or verification number."),
    ("support_impersonation", SUPPORT_IMPERSONATION, "It presents itself as a support or helpdesk contact; verify that identity independently."),
]

LEGITIMATE_CONTEXT = [
    re.compile(r"\b(?:statement|appointment|meeting|maintenance|coursework|training|delivered|scheduled)\b[^.?!]{0,100}\b(?:available|confirmed|attached|closed|submit|reception|official app|usual portal)\b", re.I),
    re.compile(r"\b(?:never|do not|don't|dont|avoid)\b[^.?!]{0,80}\b(?:click|share|send|enter|provide)\b", re.I),
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


def _first_phrase(pattern: re.Pattern[str], text: str) -> str:
    match = pattern.search(text)
    return re.sub(r"\s+", " ", match.group(0)).strip() if match else ""


def contextual_analysis(text: str, probability: float, model: ScamShieldModel) -> dict:
    """Blend the transparent baseline with conservative, contextual rules.

    The rules are deliberately phrase-based: ordinary words are not evidence by
    themselves, and awareness text is not treated as an instruction to attack.
    The returned score is a screening signal, not a calibrated probability.
    """
    clean = re.sub(r"\s+", " ", text).strip()
    evidence = []
    matched = []
    score = 0.08 + max(0.0, min(0.18, (probability - 0.5) * 0.25))
    negated = bool(NEGATED_SECURITY.search(clean))
    educational = bool(EDUCATIONAL_CONTEXT.search(clean))
    protective = bool(PROTECTIVE_ADVICE.search(clean)) or negated
    for key, pattern, message in SIGNAL_RULES:
        phrase = _first_phrase(pattern, clean)
        if phrase:
            matched.append(key)
            evidence.append({"phrase": phrase, "explanation": message})
        score += {"urgency": .18, "credentials": .45, "payment": .28, "link": .12, "impersonation": .12, "family_impersonation": .30, "authentication_code": .38, "support_impersonation": .10}[key]
    if protective or educational:
        score -= 0.45
        matched = []
        evidence = []
    if "credentials" in matched and ("urgency" in matched or "impersonation" in matched):
        score += 0.12
    if "authentication_code" in matched and "support_impersonation" in matched:
        score += 0.16
    if "payment" in matched and "urgency" in matched:
        score += 0.08
    if any(pattern.search(clean) for pattern in LEGITIMATE_CONTEXT):
        score -= 0.16
    if protective or educational:
        # A warning about scams is not itself a scam request. Keep the
        # classifier's explanation conservative even if lexical training
        # features contain words such as password, bank or code.
        score = min(score, 0.18)
    score = round(max(0.02, min(0.98, score)), 3)
    if score >= 0.68:
        label, band = "High risk", "High caution"
        action = "Do not click, pay or share credentials. Contact the organisation or person using a number or website you already trust."
    elif score >= 0.36:
        label, band = "Needs verification", "Uncertain"
        action = "Pause before acting. Verify the sender and request independently; do not use contact details in the message."
    else:
        label, band = "Few warning signs detected", "Lower caution"
        action = "No strong scam pattern was detected. This does not prove authenticity; continue without sharing sensitive information until the request is independently verified."
    if not evidence:
        evidence = [{"phrase": "No specific scam phrase detected", "explanation": "The screening rules found no strong, contextual warning signal in this message."}]
    reasons = [f"“{item['phrase']}” — {item['explanation']}" for item in evidence[:4]]
    return {
        "label": label,
        "band": band,
        "probability": score,
        "risk_score": score,
        "score_meaning": "Screening signal, not a calibrated probability or proof of fraud.",
        "reasons": reasons,
        "evidence": evidence[:4],
        "signals": matched,
        "action": action,
        "model_version": "contextual-baseline-v3",
    }


def explain(text: str, probability: float, model: ScamShieldModel) -> dict:
    return contextual_analysis(text, probability, model)


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
