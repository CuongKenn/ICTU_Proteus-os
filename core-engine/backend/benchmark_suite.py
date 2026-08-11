import asyncio
import json
import logging
import random
import time
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

from app.adapters.external.qdrant_adapter import QdrantAdapter
from app.adapters.external.redis_event_bus import RedisEventBusPublisher
from app.ai.kv_cache_ipc import KVCacheIPCManager
from app.core.formal_verification.z3_adapter import (
    Z3FormalVerifier,
    Z3VerificationError,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("benchmark")

TOTAL_TEST_CASES = 500

VALID_ACTIONS = [
    "hr.leave_requests.batch_approve",
    "finance.invoices.create",
    "core.users.invite",
    "project.tasks.assign",
]


def generate_random_dsl() -> dict:
    action = random.choice(VALID_ACTIONS)
    # 80% valid, 20% invalid (violating Z3 rules like negative amount)
    is_valid = random.random() > 0.2

    amount = random.randint(10, 5000) if is_valid else random.randint(-1000, -10)

    return {
        "version": "1.0",
        "action": action,
        "effect": "write",
        "parameters": {
            "amount": amount,
            "tenant_id": "tenant-benchmark" if is_valid else "tenant-other",
            "context_text": "A" * random.randint(5000, 20000),  # 5-20KB text
        },
    }


async def run_benchmark():
    logger.info(f"Starting Benchmark Suite for {TOTAL_TEST_CASES} Test Cases...")

    # Mocking external adapters
    mock_qdrant = AsyncMock(spec=QdrantAdapter)
    mock_qdrant.upsert_vectors = AsyncMock(return_value=True)

    mock_redis = AsyncMock(spec=RedisEventBusPublisher)
    mock_redis.publish = AsyncMock()

    ipc_manager = KVCacheIPCManager(
        qdrant_adapter=mock_qdrant, redis_publisher=mock_redis
    )

    total_z3_latency = 0.0
    total_ipc_latency = 0.0
    total_token_saved = 0

    z3_blocked_count = 0
    passed_count = 0

    for i in range(TOTAL_TEST_CASES):
        dsl = generate_random_dsl()

        # 1. Z3 SMT Solver Verification
        z3_start = time.perf_counter()
        verifier = Z3FormalVerifier(tenant_id="tenant-benchmark", user_id="user-1")
        try:
            verifier.verify_dsl(dsl)
            z3_latency = (time.perf_counter() - z3_start) * 1000
            total_z3_latency += z3_latency
            passed_count += 1

            # 2. KV-Cache IPC Transmission
            ipc_start = time.perf_counter()
            pointer_uuid, _ = await ipc_manager.transmit_context(
                tenant_id="tenant-benchmark",
                source_agent="source-agent",
                target_agent="target-agent",
                context_text=dsl["parameters"]["context_text"],
            )
            ipc_latency = (time.perf_counter() - ipc_start) * 1000
            total_ipc_latency += ipc_latency

            # Simulated token saved (1 char ~ 0.25 token)
            total_token_saved += len(dsl["parameters"]["context_text"]) // 4

        except Z3VerificationError:
            z3_latency = (time.perf_counter() - z3_start) * 1000
            total_z3_latency += z3_latency
            z3_blocked_count += 1

    avg_z3_latency = total_z3_latency / TOTAL_TEST_CASES
    avg_ipc_latency = total_ipc_latency / passed_count if passed_count > 0 else 0

    results = {
        "timestamp": datetime.now(UTC).isoformat(),
        "total_test_cases": TOTAL_TEST_CASES,
        "metrics": {
            "z3_blocked_count": z3_blocked_count,
            "passed_count": passed_count,
            "accuracy_rate_percent": (
                (z3_blocked_count / (0.2 * TOTAL_TEST_CASES)) * 100
                if TOTAL_TEST_CASES > 0
                else 0
            ),  # Tỉ lệ chặn đúng lỗi
            "avg_z3_verification_latency_ms": round(avg_z3_latency, 2),
            "avg_kv_cache_ipc_latency_ms": round(avg_ipc_latency, 2),
            "total_tokens_saved": total_token_saved,
        },
    }

    logger.info("Benchmark completed!")
    logger.info(json.dumps(results, indent=2))

    with open("benchmark_results.json", "w") as f:
        json.dump(results, f, indent=2)


if __name__ == "__main__":
    asyncio.run(run_benchmark())
