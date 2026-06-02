"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslations } from "@/i18n/provider";
import { type User, usersApi } from "@/lib/api";
import { type UserRole } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1),
  role: z.enum(["ADMIN", "USER"]),
});

type FormValues = z.infer<typeof schema>;

export function EditUserDialog({ user }: { user: User }) {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: user.name ?? "", role: user.role },
  });

  const nameMutation = useMutation({
    mutationFn: (name: string) => usersApi.update(user.id, { name }),
  });

  const roleMutation = useMutation({
    mutationFn: (role: UserRole) => usersApi.updateRole(user.id, role),
  });

  const onSubmit = async (values: FormValues) => {
    try {
      const promises: Promise<unknown>[] = [];
      if (values.name !== (user.name ?? "")) {
        promises.push(nameMutation.mutateAsync(values.name));
      }
      if (values.role !== user.role) {
        promises.push(roleMutation.mutateAsync(values.role as UserRole));
      }
      if (promises.length > 0) {
        await Promise.all(promises);
        qc.invalidateQueries({ queryKey: ["users"] });
        toast.success(t("editUser"));
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : tc("save"));
    }
  };

  const isPending = nameMutation.isPending || roleMutation.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) form.reset({ name: user.name ?? "", role: user.role });
      }}
    >
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editUser")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("namePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("role")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ADMIN">{t("roles.ADMIN")}</SelectItem>
                      <SelectItem value="USER">{t("roles.USER")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? tc("saving") : tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
