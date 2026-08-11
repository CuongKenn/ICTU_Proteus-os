# Copyright (c) 2026 CuongKenn & ICTU Team
# SPDX-License-Identifier: AGPL-3.0-or-later

"""
Z3 SMT Solver Adapter for Formal Verification of DX-DSL.
Ensures zero-hallucination at the architectural level.
"""

from typing import Any

from z3 import Real, Solver, StringVal, sat, unsat


class Z3VerificationError(Exception):
    pass


class Z3FormalVerifier:
    def __init__(self, tenant_id: str, user_id: str):
        self.tenant_id = tenant_id
        self.user_id = user_id

    def verify_dsl(self, dsl_payload: dict[str, Any]) -> bool:
        """
        Verify the DX-DSL payload against mathematical and logical invariants.
        Raises Z3VerificationError if the model is unsatisfiable (violates invariants).
        """
        solver = Solver()

        # 1. Tenant Boundary Invariant (RLS)
        # Ensure that if the DSL attempts to specify a tenant_id, it MUST match the context tenant_id.
        ctx_tenant = StringVal(self.tenant_id)
        provided_tenant_str = dsl_payload.get("tenant_id")

        # We model this by asserting equality
        if provided_tenant_str is not None:
            provided_tenant = StringVal(str(provided_tenant_str))
            solver.add(provided_tenant == ctx_tenant)

        # 2. Action specific mathematical invariants
        action = dsl_payload.get("action", "")
        params = dsl_payload.get("parameters", {})

        if action == "finance.invoices.create":
            # Invariant: Invoice amount must be strictly greater than 0
            # Invariant: Tax rate must be between 0 and 1
            amount_val = params.get("amount")
            if amount_val is not None:
                amount_var = Real("amount")
                solver.add(amount_var == float(amount_val))
                solver.add(amount_var > 0)

            tax_val = params.get("tax_rate")
            if tax_val is not None:
                tax_var = Real("tax_rate")
                solver.add(tax_var == float(tax_val))
                solver.add(tax_var >= 0)
                solver.add(tax_var <= 1.0)

        elif action == "asset.transfer":
            # Invariant: From Location and To Location must be different
            from_loc_val = params.get("from_location")
            to_loc_val = params.get("to_location")

            if from_loc_val is not None and to_loc_val is not None:
                from_var = StringVal(str(from_loc_val))
                to_var = StringVal(str(to_loc_val))
                solver.add(from_var != to_var)

        # Check for Satisfiability
        result = solver.check()

        if result == sat:
            return True
        elif result == unsat:
            raise Z3VerificationError(
                "Formal Verification Failed: The DX-DSL payload violates critical mathematical invariants. Model is UNSAT."
            )
        else:
            raise Z3VerificationError(
                "Formal Verification Failed: Z3 Solver returned unknown state."
            )
