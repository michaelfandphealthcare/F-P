# Logo source register

ScamShield uses local copies under `web/static/assets/logos/` so the interface does not depend on fragile image hotlinks. The assets are displayed as scenario context only; the scenarios are fictional and do not imply sponsorship, partnership, endorsement or a verified incident.

| Organisation | Local asset | Official source / guidance | Implementation note |
| --- | --- | --- | --- |
| Lloyds Bank | `lloyds-bank-official.png` | [Lloyds legal information](https://www.lloydsbank.com/help-guidance/legal-information/legal-entities.html) and [Lloyds Banking Group brands](https://www.lloydsbankinggroup.com/who-we-are/our-brands.html) | The transparent horse mark is used at a readable size with a separate text label; no CSS recolouring or plate is applied. |
| Leeds Beckett University | text fallback in the dark scenario card; official source retained in `leeds-beckett-official.svg` | [Leeds Beckett brand guidelines](https://www.leedsbeckett.ac.uk/-/media/files/brand/lbu-brand-guidelines.pdf) | The guide confirms a white/reversed variant is approved on dark backgrounds, but a usable official reversed asset was not available in the local set. The interface therefore uses a readable organisation-name fallback rather than displaying an invisible or invented mark. |
| Premier League | `premier-league.svg` | [Premier League logo site](https://logo.premierleague.com/) | The local mark is the white-on-dark treatment; do not recolour or crop it. |
| NHS | `nhs.svg` | [NHS logo guidance](https://www.england.nhs.uk/nhsidentity/identity-guidelines/nhs-logo/) | NHS guidance says to use original artwork and protect clear space; this is shown as fictional context only. |

## Usage boundary

These marks remain the property of their respective organisations. ScamShield is an academic prototype and is not presented as an official service of any named organisation. Before public or commercial distribution, confirm permission and replace any locally sourced asset that is not cleared for the intended use.
