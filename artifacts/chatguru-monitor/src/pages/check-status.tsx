import React from "react";
import { useCheckChatStatus, type ConversationStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { formatPhone } from "@/lib/utils";
import { Search, AlertCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const schema = z.object({
  chatNumber: z.string().min(10, "Número deve ter no mínimo 10 dígitos").regex(/^\d+$/, "Apenas números"),
});

export function CheckStatus() {
  const checkStatus = useCheckChatStatus();
  
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      chatNumber: "",
    },
  });

  function onSubmit(values: z.infer<typeof schema>) {
    checkStatus.mutate({ data: { chatNumber: values.chatNumber } });
  }

  const response = checkStatus.data;
  const isError = checkStatus.isError;
  const isPending = checkStatus.isPending;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Consultar Status</h1>
        <p className="text-muted-foreground mt-1">Verifique o status de um número diretamente na API do ChatGuru.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Consultar Número</CardTitle>
          <CardDescription>
            Insira o número de telefone com código do país e DDD (ex: 5511999999999).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="chatNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número do WhatsApp</FormLabel>
                    <div className="flex gap-4">
                      <FormControl>
                        <Input placeholder="5511999999999" {...field} />
                      </FormControl>
                      <Button type="submit" disabled={isPending} className="w-32">
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Consultar"}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </CardContent>
      </Card>

      {isError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 flex flex-col items-center justify-center text-center text-destructive py-8">
            <AlertCircle className="w-12 h-12 mb-4 opacity-80" />
            <h3 className="font-semibold text-lg">Erro na consulta</h3>
            <p className="text-sm opacity-80 mt-1">Não foi possível consultar a API do ChatGuru.</p>
          </CardContent>
        </Card>
      )}

      {response && (
        <Card className="border-primary/20 bg-card overflow-hidden">
          <div className="bg-primary/5 px-6 py-4 border-b border-primary/10">
            <h3 className="font-semibold flex items-center gap-2">
              <Search className="w-4 h-4 text-primary" />
              Resultado da Consulta
            </h3>
          </div>
          <CardContent className="p-6">
            <div className="grid gap-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Número</div>
                  <div className="font-semibold text-lg">{formatPhone(response.chatNumber)}</div>
                  <div className="text-xs text-muted-foreground">{response.chatNumber}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Status no ChatGuru</div>
                  <div className="mt-1">
                    {response.found ? (
                      <StatusBadge status={(response.status as ConversationStatus) || "unknown"} />
                    ) : (
                      <span className="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-destructive/10 text-destructive">
                        Não Encontrado
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {response.raw && Object.keys(response.raw).length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm font-medium text-muted-foreground mb-3">Dados brutos da resposta</div>
                  <pre className="bg-muted p-4 rounded-lg text-xs font-mono overflow-auto max-h-64 border border-border">
                    {JSON.stringify(response.raw, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
