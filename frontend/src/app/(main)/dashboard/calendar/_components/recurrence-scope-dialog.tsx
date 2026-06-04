"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/i18n/provider";
import type { RecurrenceScope } from "@/lib/events-api";

interface RecurrenceScopeDialogProps {
  open: boolean;
  action: "edit" | "delete";
  onConfirm: (scope: RecurrenceScope) => void;
  onCancel: () => void;
}

const SCOPE_OPTIONS: { value: RecurrenceScope; descKey: string }[] = [
  { value: "THIS_ONLY", descKey: "scope.thisOnlyDesc" },
  { value: "THIS_AND_FOLLOWING", descKey: "scope.thisAndFollowingDesc" },
  { value: "ALL", descKey: "scope.allDesc" },
];

export function RecurrenceScopeDialog({ open, action, onConfirm, onCancel }: RecurrenceScopeDialogProps) {
  const t = useTranslations("recurrence");
  const tc = useTranslations("common");
  const [scope, setScope] = useState<RecurrenceScope>("THIS_ONLY");
  const isDelete = action === "delete";

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{isDelete ? t("deleteTitle") : t("editTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{isDelete ? t("deleteQuestion") : t("editQuestion")}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          {SCOPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex items-start gap-3 cursor-pointer rounded-lg border p-3 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors"
            >
              <input
                type="radio"
                name="scope"
                value={opt.value}
                checked={scope === opt.value}
                onChange={() => setScope(opt.value)}
                className="mt-0.5 accent-primary"
              />
              <div>
                <div className="text-sm font-medium">{t(`scope.${opt.value}`)}</div>
                <div className="text-xs text-muted-foreground">{t(opt.descKey)}</div>
              </div>
            </label>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{tc("cancel")}</AlertDialogCancel>
          <Button
            variant={isDelete ? "destructive" : "default"}
            onClick={() => onConfirm(scope)}
          >
            {isDelete ? tc("delete") : t("continueEdit")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
