"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppSelect } from "@/components/ui/app-select";
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
import { useTranslations } from "@/i18n/provider";
import { usersApi } from "@/lib/api";
import { rolesApi } from "@/lib/roles-api";

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
  roleId: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export function CreateUserDialog() {
  const t = useTranslations("users");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: rolesApi.list });
  const roleOptions = roles.map((r) => ({ value: r.id, label: r.displayName }));
  const userRoleId = roles.find((r) => r.name === "USER")?.id ?? "";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "", roleId: "" },
  });

  // Set USER role as default once roles finish loading (avoids setValue during render)
  useEffect(() => {
    if (userRoleId && !form.getValues("roleId")) {
      form.setValue("roleId", userRoleId);
    }
  }, [userRoleId, form]);

  const mutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setOpen(false);
      form.reset();
      toast.success(t("createUser"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) form.reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-2" />
          {t("newUser")}
        </Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t("createUser")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-4 pt-2">
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
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("email")}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder={t("emailPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("password")}</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder={t("passwordPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("role")}</FormLabel>
                  <AppSelect
                    value={field.value}
                    onValueChange={(v) => field.onChange(v ?? "")}
                    options={roleOptions}
                    placeholder={t("role")}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? tc("creating") : tc("create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
