import io

from openpyxl import load_workbook


async def test_stats_for_staff(specialist):
    body = (await specialist.get("/api/v1/admin/stats")).json()
    assert body["applications_total"] >= 10
    assert body["competitions_open"] >= 3
    assert len(body["daily"]) == 30
    assert body["by_rayon"] and body["by_purpose"]


async def test_stats_hidden_from_entrepreneurs(entrepreneur):
    assert (await entrepreneur.get("/api/v1/admin/stats")).status_code == 403


async def test_public_stats_have_no_personal_data(client):
    body = (await client.get("/api/v1/stats/public")).json()
    assert set(body) == {
        "competitions_open",
        "areas_offered",
        "hectares_offered",
        "applications_total",
        "decisions",
        "planned_investment_azn",
        "planned_jobs",
    }


async def test_excel_report_is_masked_and_readable(specialist):
    r = await specialist.get("/api/v1/admin/reports/applications.xlsx")
    assert r.status_code == 200
    wb = load_workbook(io.BytesIO(r.content))
    ws = wb["Müraciətlər"]
    header = [c.value for c in ws[1]]
    assert header[0] == "Nömrə" and "FİN / VÖEN" in header
    ids = [row[5].value for row in ws.iter_rows(min_row=2)]
    assert ids and all("•" in v for v in ids)
    assert {"Xülasə", "Rayonlar üzrə"} <= set(wb.sheetnames)
