"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { type Note, notesApi } from "@/lib/api";

export default function NotesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: notesApi.list,
  });

  const createMutation = useMutation({
    mutationFn: notesApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      setTitle("");
      setBody("");
      setOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: notesApi.remove,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
          <p className="text-muted-foreground text-sm">{notes.length} note{notes.length !== 1 ? "s" : ""}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4 mr-2" />
              New note
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Content (optional)"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
              />
              <Button
                className="w-full"
                disabled={!title.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate({ title, body })}
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading...</p>}

      {!isLoading && notes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground">No notes yet. Create your first one.</p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note: Note) => (
          <div
            key={note.id}
            className="group relative rounded-lg border bg-card p-4 shadow-sm"
          >
            <div className="pr-8">
              <p className="font-medium leading-tight">{note.title}</p>
              {note.body && (
                <p className="text-muted-foreground text-sm mt-1 line-clamp-3">{note.body}</p>
              )}
              <p className="text-muted-foreground/60 text-xs mt-3">
                {new Date(note.createdAt).toLocaleDateString()}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
              onClick={() => deleteMutation.mutate(note.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
