import type { CreateAlertRuleInput, PersistedAlertRule, UpdateAlertRuleInput } from "@/lib/alerting/alert-types";
import { BasePath } from "@/lib/base-path";
import { useCallback, useEffect, useState } from "react";

export function useAlertRules() {
  const [rules, setRules] = useState<PersistedAlertRule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(BasePath.getURL("/api/alerts/rules"));
      if (res.ok) {
        const data = (await res.json()) as PersistedAlertRule[];
        setRules(data);
      }
    } catch {
      // Silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const createRule = useCallback(
    async (input: Omit<CreateAlertRuleInput, "id" | "user_id">) => {
      try {
        const res = await fetch(BasePath.getURL("/api/alerts/rules"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (res.ok) {
          await fetchRules();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [fetchRules]
  );

  const updateRule = useCallback(
    async (ruleId: string, input: Partial<UpdateAlertRuleInput>) => {
      try {
        const res = await fetch(BasePath.getURL(`/api/alerts/rules/${ruleId}`), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (res.ok) {
          await fetchRules();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [fetchRules]
  );

  const deleteRule = useCallback(
    async (ruleId: string) => {
      try {
        const res = await fetch(BasePath.getURL(`/api/alerts/rules/${ruleId}`), {
          method: "DELETE",
        });
        if (res.ok) {
          await fetchRules();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [fetchRules]
  );

  const toggleRule = useCallback(
    async (ruleId: string, enabled: boolean) => {
      return updateRule(ruleId, { enabled });
    },
    [updateRule]
  );

  useEffect(() => {
    void fetchRules();
  }, [fetchRules]);

  return {
    rules,
    loading,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
  };
}
