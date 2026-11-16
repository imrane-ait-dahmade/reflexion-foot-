"""Complete digit-memory then remaining observation exercises for Demo1."""

from __future__ import annotations

import asyncio
import json

from httpx import AsyncClient

BASE = "http://127.0.0.1:8088"
SESSION = "YLRR2P43"
CODE = "VNV895"
OBS = {
    "visual-tracking",
    "visual-memory",
    "reaction-time",
    "peripheral-vision",
    "football-visual-scanning",
    "sequential-visual-search",
}


async def finish_digit(client: AsyncClient, headers: dict) -> dict:
    r = await client.post(
        "/api/v1/player/exercises/digit-memory",
        headers=headers,
        json={"action": "start"},
    )
    print("start", r.status_code, r.text[:240])
    body = r.json()
    if r.status_code >= 400:
        return body
    token = body["token"]
    length = int(body.get("length") or 3)

    while True:
        digits: list[int] = []
        for i in range(length):
            if i > 0:
                await asyncio.sleep(0.85)
            d = await client.post(
                "/api/v1/player/exercises/digit-memory",
                headers=headers,
                json={"action": "digit", "token": token},
            )
            print("digit", d.status_code, d.text[:160])
            body = d.json()
            if d.status_code >= 400:
                return body
            token = body["token"]
            digits.append(int(body["digit"]))
            if body.get("answer"):
                break

        a = await client.post(
            "/api/v1/player/exercises/digit-memory",
            headers=headers,
            json={"action": "answer", "token": token, "answer": digits},
        )
        print("answer", a.status_code, a.text[:240])
        body = a.json()
        if a.status_code >= 400:
            return body
        if body.get("finished"):
            print(
                "COMPLETE",
                json.dumps(
                    {
                        "exact": body.get("exact"),
                        "result_score": (body.get("result") or {}).get("score"),
                    },
                    default=str,
                ),
            )
            return body
        token = body["token"]
        length = int(body.get("length") or (length + 1))


async def main() -> None:
    async with AsyncClient(base_url=BASE, timeout=120.0) as client:
        join = await client.post(
            "/api/v1/player/session/join",
            json={"personal_code": CODE, "session_code": SESSION},
        )
        print("join", join.status_code)
        join.raise_for_status()
        headers = {"Authorization": f"Bearer {join.json()['access_token']}"}
        await finish_digit(client, headers)
        prog = await client.get("/api/v1/player/session", headers=headers)
        for e in prog.json().get("exercises", []):
            slug = e["slug"]
            completed = bool(e.get("completed") or e.get("completed_at"))
            print("check", slug, "completed=" + str(completed))
            if completed:
                continue
            if slug in OBS:
                r = await client.post(
                    f"/api/v1/player/exercises/{slug}/complete",
                    headers=headers,
                    json={
                        "score": 78,
                        "accuracy": 78.0,
                        "response_time_ms": 1500,
                        "correct_answers": 7,
                        "errors": 2,
                        "average_reaction_ms": 390,
                        "best_reaction_ms": 270,
                        "duration_ms": 1500,
                        "metrics": {"demo": True},
                    },
                )
                print("obs", slug, r.status_code, r.text[:140])
            else:
                print("left", slug)


if __name__ == "__main__":
    asyncio.run(main())
