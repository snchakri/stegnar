#!/bin/bash
sleep 65
echo "=== Routing Logs (last 25 lines) ==="
docker logs stegnar-routing | grep -v '^$' | tail -n 25
echo ""
echo "=== Database Verdicts (this session) ==="
docker exec stegnar-postgres psql -U stegnar -c "SELECT ts, endpoint_id, verdict, ROUND(steg_score::numeric,4) as confidence, bytes_total FROM network_events WHERE ts > '2026-04-28 22:08:00' ORDER BY ts ASC;"
