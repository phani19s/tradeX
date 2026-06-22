from types import SimpleNamespace

from app.services.alert_service import alert_matches
from app.services.market_intelligence_service import infer_sector


def make_alert(condition_type, target_price):
    return SimpleNamespace(
        condition_type=condition_type,
        target_price=target_price,
    )


def test_alert_matches_greater_than():
    assert alert_matches(make_alert("GREATER_THAN", 100), 101)
    assert not alert_matches(make_alert("GREATER_THAN", 100), 100)


def test_alert_matches_less_equal():
    assert alert_matches(make_alert("LESS_EQUAL", 100), 100)
    assert alert_matches(make_alert("LESS_EQUAL", 100), 99)
    assert not alert_matches(make_alert("LESS_EQUAL", 100), 101)


def test_sector_inference_known_symbols():
    assert infer_sector("TCS") == "IT"
    assert infer_sector("HDFCBANK") == "Banking"
    assert infer_sector("RELIANCE") == "Energy"
