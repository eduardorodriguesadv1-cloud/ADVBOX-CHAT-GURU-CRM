import React, { useState } from "react";
import { useListConversations, getListConversationsQueryKey, type ListConversationsStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/status-badge";
import { formatPhone, formatDate } from "@/lib/utils";
import { Search, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";

function ContextDataPopover({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-primary px-2">
          <FileText className="w-3 h-3" />
          {entries.length} dado{entries.length > 1 ? "s" : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Dados do Atendimento</p>
        <div className="space-y-1.5">
          {entries.map(([k, v]) => (
            <div key={k} className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground shrink-0 min-w-[80px] capitalize">{k.replace(/_/g, " ")}:</span>
              <span className="font-medium break-all">{String(v)}</span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Conversations() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ListConversationsStatus | "all">("all");
  const debouncedSearch = useDebounce(search, 500);

  const { data, isLoading, isFetching } = useListConversations({
    query: {
      queryKey: getListConversationsQueryKey({
        search: debouncedSearch || undefined,
        status: status === "all" ? undefined : status as ListConversationsStatus,
        limit: 50
      }),
      keepPreviousData: true
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Conversas</h1>
        <p className="text-muted-foreground mt-1">Lista completa de atendimentos.</p>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar por número ou nome..." 
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-64">
              <Select value={status} onValueChange={(val: any) => setStatus(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Status</SelectItem>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="in_progress">Em Atendimento</SelectItem>
                  <SelectItem value="waiting">Aguardando</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border relative">
            {isFetching && !isLoading && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agente</TableHead>
                  <TableHead>Última Mensagem</TableHead>
                  <TableHead>Dados</TableHead>
                  <TableHead className="text-right">Atualização</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : data?.conversations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma conversa encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.conversations.map((conv) => (
                    <TableRow key={conv.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {conv.contactName || formatPhone(conv.chatNumber)}
                        </div>
                        {conv.contactName && (
                          <div className="text-xs text-muted-foreground">
                            {formatPhone(conv.chatNumber)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={conv.status} />
                      </TableCell>
                      <TableCell>
                        {conv.assignedAgent || <span className="text-muted-foreground italic text-xs">Não atribuído</span>}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                         <span className="truncate block text-sm text-muted-foreground">
                          {conv.lastMessage || "-"}
                         </span>
                      </TableCell>
                      <TableCell>
                        {conv.contextData && Object.keys(conv.contextData).length > 0
                          ? <ContextDataPopover data={conv.contextData as Record<string, unknown>} />
                          : <span className="text-muted-foreground text-xs italic">—</span>
                        }
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {formatDate(conv.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {data?.total !== undefined && (
            <div className="mt-4 text-sm text-muted-foreground text-right">
              Mostrando {data.conversations.length} de {data.total} conversas
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
