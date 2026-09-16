# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

import ipaddress

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

# M5: chỉ trust X-Forwarded-For khi peer trực tiếp là proxy đáng tin
# (loopback / private / unix-socket). Mặc định fail-closed về client.host
# để chống spoof IP vượt rate-limit.
_TRUSTED_PROXY_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
]


def _peer_is_trusted_proxy(request: Request) -> bool:
    try:
        peer = request.client.host if request.client else ""
        if not peer:
            return False
        ip = ipaddress.ip_address(peer)
        return any(ip in net for net in _TRUSTED_PROXY_NETWORKS)
    except ValueError:
        return False


def get_real_client_ip(request: Request) -> str:
    # M5: chỉ dùng XFF khi peer là trusted proxy, còn lại fallback client.host.
    if _peer_is_trusted_proxy(request):
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            first = forwarded.split(",")[0].strip()
            if first:
                return first
    return get_remote_address(request)


limiter = Limiter(key_func=get_real_client_ip)
