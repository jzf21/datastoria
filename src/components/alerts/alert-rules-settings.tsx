import type { PersistedAlertRule } from "@/lib/alerting/alert-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Pencil, Plus, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { AlertRuleForm } from "./alert-rule-form";
import { useAlertRules } from "./use-alert-rules";

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "CRITICAL") {
    return (
      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
        <XCircle className="h-2.5 w-2.5 mr-0.5" />
        Critical
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-yellow-500 border-yellow-500/30">
      <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
      Warning
    </Badge>
  );
}

function RuleItem({
  rule,
  onToggle,
  onEdit,
  onDelete,
}: {
  rule: PersistedAlertRule;
  onToggle: (ruleId: string, enabled: boolean) => void;
  onEdit: (rule: PersistedAlertRule) => void;
  onDelete: (ruleId: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0">
      <Switch
        checked={rule.enabled}
        onCheckedChange={(checked) => onToggle(rule.id, checked)}
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{rule.name}</span>
          <SeverityBadge severity={rule.severity} />
        </div>
        {rule.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{rule.description}</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {rule.condition.metric_field} {rule.condition.operator} {rule.condition.threshold}
          {" | "}Check every {rule.evaluation_interval_seconds}s
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => onEdit(rule)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(rule.id)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function AlertRulesSettings() {
  const { rules, loading, createRule, updateRule, toggleRule, deleteRule } = useAlertRules();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<PersistedAlertRule | null>(null);

  const handleEdit = (rule: PersistedAlertRule) => {
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingRule(null);
    setShowForm(true);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-4 py-3 border-b">
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleCreate}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Create Rule
        </Button>
      </div>

      {showForm && (
        <div className="border-b">
          <AlertRuleForm
            initialValues={editingRule ?? undefined}
            onSubmit={async (input) => {
              let ok: boolean;
              if (editingRule) {
                ok = await updateRule(editingRule.id, input);
              } else {
                ok = await createRule({
                  ...input,
                  rule_type: "custom",
                });
              }
              if (ok) {
                setShowForm(false);
                setEditingRule(null);
              }
            }}
            onCancel={() => {
              setShowForm(false);
              setEditingRule(null);
            }}
            submitLabel={editingRule ? "Save Changes" : "Create Rule"}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && rules.length === 0 && (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Loading...
          </div>
        )}
        {!loading && rules.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No alert rules configured</p>
            <p className="text-xs mt-1">
              Click &quot;Create Rule&quot; to add a new alert
            </p>
          </div>
        )}
        {rules.map((rule) => (
          <RuleItem
            key={rule.id}
            rule={rule}
            onToggle={toggleRule}
            onEdit={handleEdit}
            onDelete={deleteRule}
          />
        ))}
      </div>
    </div>
  );
}
