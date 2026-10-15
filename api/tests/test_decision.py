"""Compare: TOPSIS ranking with user weights, missing data and a sensitivity check."""

from app.modules.areas import decision
from app.modules.areas.decision import Alternative


def _alt(code, suitability, fee, investment, water, road, reason=None):
    values = {
        "suitability": suitability,
        "fee": fee,
        "investment": investment,
        "water": water,
        "road": road,
    }
    return Alternative(code, values, reason)


def test_a_plot_better_on_every_criterion_wins_with_full_closeness():
    result = decision.rank(
        [_alt("A", 90, 20, 100_000, 0.2, 0.5), _alt("B", 60, 35, 300_000, 2.0, 3.0)],
        decision.PRESETS["balanced"],
    )
    assert result.ranking == ["A", "B"]
    assert result.closeness["A"] == 1.0 and result.closeness["B"] == 0.0
    assert result.stability == 1.0


def test_weights_decide_between_trade_offs():
    cheap = _alt("CHEAP", 55, 12, 100_000, 2.5, 4.0)
    good = _alt("GOOD", 92, 35, 400_000, 0.3, 0.4)
    assert decision.rank([cheap, good], decision.PRESETS["cost"]).ranking[0] == "CHEAP"
    assert decision.rank([cheap, good], decision.PRESETS["suitability"]).ranking[0] == "GOOD"


def test_missing_values_never_help_a_plot():
    result = decision.rank(
        [_alt("A", 80, 20, None, 1.0, 1.0), _alt("B", 80, 20, 200_000, 1.0, 1.0)],
        decision.PRESETS["balanced"],
    )
    assert result.imputed["A"] == ["investment"]
    assert result.closeness["A"] <= result.closeness["B"]


def test_unsuitable_plots_are_left_out():
    result = decision.rank(
        [
            _alt("A", 80, 20, 1, 1, 1),
            _alt("B", 70, 20, 1, 1, 1),
            _alt("C", 99, 1, 1, 0, 0, "minalar"),
        ],
        decision.PRESETS["balanced"],
    )
    assert "C" not in result.ranking and result.notes == ["C: minalar"]


def test_weights_are_normalised():
    w = decision.normalise({"suitability": 2, "fee": 2, "investment": 0, "water": 0, "road": 0})
    assert w["suitability"] == w["fee"] == 0.5 and abs(sum(w.values()) - 1) < 1e-9
    assert sum(decision.normalise({}).values()) == 1


async def test_rank_endpoint_explains_the_result(client):
    items = (await client.get("/api/v1/areas", params={"open_only": "true", "size": 3})).json()[
        "items"
    ]
    codes = [i["code"] for i in items]
    body = (
        await client.post(
            "/api/v1/areas/compare/rank",
            json={"codes": codes, "activity": "CROP", "preset": "balanced"},
        )
    ).json()
    assert body["method"] == "TOPSIS"
    assert abs(sum(body["weights"].values()) - 1) < 0.01
    ranked = [r for r in body["ranking"] if r["rank"]]
    assert [r["rank"] for r in ranked] == list(range(1, len(ranked) + 1))
    assert {c["key"] for c in body["criteria"]} == set(decision.CRITERIA)
    assert body["explanation"] and 0 <= body["stability"] <= 1
    assert "Maşın öyrənməsi" in body["note"]
    assert all("̇" not in line for line in body["explanation"])  # İ lower-cased right


async def test_rank_endpoint_validates_input(client):
    r = await client.post(
        "/api/v1/areas/compare/rank", json={"codes": ["AGM-0001"], "activity": "CROP"}
    )
    assert r.status_code == 422
    r = await client.post(
        "/api/v1/areas/compare/rank", json={"codes": ["AGM-0001", "AGM-0003"], "activity": "OTHER"}
    )
    assert r.status_code == 422
    excluded = (
        await client.post(
            "/api/v1/areas/compare/rank",
            json={"codes": ["AGM-0001", "AGM-0002", "AGM-0003"], "activity": "CROP"},
        )
    ).json()
    out = next(r for r in excluded["ranking"] if r["code"] == "AGM-0002")
    assert out["rank"] is None and out["excluded_reason"]
