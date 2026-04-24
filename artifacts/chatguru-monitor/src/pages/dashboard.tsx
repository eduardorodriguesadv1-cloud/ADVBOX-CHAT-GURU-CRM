import React from "react";
import { useGetStats, getGetStatsQueryKey, useGetWebhookUrl, getGetWebhookUrlQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { formatPhone, formatDate } from "@/lib/utils";
import { Copy, AlertCircle, RefreshCw, MessageSquare, Clock, CheckCircle2, XCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function Dashboard() {
  const { toast } = useToast();
  
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats, isFetching } = useGetStats({
    query: {
      queryKey: getGetStatsQueryKey(),
      refetchInterval: 30000, // Refresh every 30s
    }
  });

  const { data: webhookInfo, isLoading: webhookLoading } = useGetWebhookUrl({
    query: {
      queryKey: getGetWebhookUrlQueryKey(),
    }
  });

  const copyWebhook = () => {
    if (webhookInfo?.url) {
      navigator.clipboard.writeText(webhookInfo.url);
      toast({
        title: "Copiado!",
        description: "URL do Webhook copiada para a área de transferência.",
      });
    }
  };

  const statCards = [
    { title: "Total Hoje", value: stats?.todayTotal ?? 0, icon: Users, color: "text-blue-500" },
    { title: "Abertos", value: stats?.open ?? 0, icon: AlertCircle, color: "text-amber-500" },
    { title: "Em Atendimento", value: stats?.inProgress ?? 0, icon: MessageSquare, color: "text-blue-500" },
    { title: "Aguardando", value: stats?.waiting ?? 0, icon: Clock, color: "text-orange-500" },
    { title: "Resolvidos", value: stats?.resolved ?? 0, icon: CheckCircle2, color: "text-green-500" },
    { title: "Fechados", value: stats?.closed ?? 0, icon: XCircle, color: "text-slate-500" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Principal</h1>
          <p className="text-muted-foreground mt-1">Visão geral da operação de atendimento.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetchStats()} 
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {statsError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>
            Não foi possível carregar as estatísticas. Verifique a conexão com a API.
          </AlertDescription>
        </Alert>
      )}

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))
        ) : (
          statCards.map((card, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <card.icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Atividades Recentes</CardTitle>
              <CardDescription>Últimas interações nos atendimentos.</CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-6 w-24" />
                    </div>
                  ))}
                </div>
              ) : stats?.recentActivity && stats.recentActivity.length > 0 ? (
                <div className="space-y-6">
                  {stats.recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start justify-between border-b pb-6 last:border-0 last:pb-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            {activity.contactName || formatPhone(activity.chatNumber)}
                          </span>
                          {activity.contactName && (
                            <span className="text-xs text-muted-foreground">
                              {formatPhone(activity.chatNumber)}
                            </span>
                          )}
                        </div>
                        {activity.lastMessage && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {activity.lastMessage}
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDate(activity.lastMessageAt || activity.updatedAt)}
                          {activity.assignedAgent && (
                            <>
                              <span>•</span>
                              <span>Agente: {activity.assignedAgent}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <StatusBadge status={activity.status} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhuma atividade recente registrada.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuração ChatGuru</CardTitle>
              <CardDescription>URL do Webhook para integração.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {webhookLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-muted rounded-md text-sm truncate font-mono text-muted-foreground border border-border">
                      {webhookInfo?.url || "URL não disponível"}
                    </code>
                    <Button variant="secondary" size="icon" onClick={copyWebhook} title="Copiar">
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  {webhookInfo?.instructions && (
                    <div className="p-4 bg-primary/5 border border-primary/20 rounded-md text-sm text-primary/80">
                      {webhookInfo.instructions}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
