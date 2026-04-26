import { db, agentsTable, whatsappNumbersTable, tagsTable } from "@workspace/db";

async function seed() {
  console.log("🌱 Iniciando seed...");

  // Números de WhatsApp
  await db.insert(whatsappNumbersTable).values([
    { number: "5581918506470", label: "Comercial", team: "COMERCIAL_TRAFEGO" },
    { number: "5581993045260", label: "Base", team: "ATENDIMENTO" },
  ]).onConflictDoNothing();
  console.log("✅ Números de WhatsApp inseridos");

  // Atendentes
  await db.insert(agentsTable).values([
    { name: "Thiago Tavares", team: "COMERCIAL_TRAFEGO", active: true },
    { name: "Tammyres", team: "COMERCIAL_TRAFEGO", active: true },
    { name: "Letícia", team: "ATENDIMENTO", active: true },
    { name: "Marília", team: "ATENDIMENTO", active: true },
    { name: "Alice", team: "ATENDIMENTO", active: true },
    { name: "Cau", team: "ATENDIMENTO", active: true },
  ]).onConflictDoNothing();
  console.log("✅ Atendentes inseridos");

  // Tags
  const tags = [
    // ORIGEM
    { name: "TRÁFEGO PAGO", category: "ORIGEM" },
    { name: "PARCEIRO", category: "ORIGEM" },
    { name: "DIGITAL", category: "ORIGEM" },
    { name: "ORGÂNICO", category: "ORIGEM" },
    { name: "OUTRO MEIO", category: "ORIGEM" },
    // SETOR
    { name: "COMERCIAL TRÁFEGO", category: "SETOR" },
    { name: "ATENDIMENTO", category: "SETOR" },
    // STATUS
    { name: "LEAD NOVO", category: "STATUS" },
    { name: "LEAD QUALIFICADO", category: "STATUS" },
    { name: "FOLLOW UP", category: "STATUS" },
    { name: "CONTRATO ASSINADO", category: "STATUS" },
    { name: "CLIENTE ATIVO", category: "STATUS" },
    { name: "CLIENTE PROCEDENTE", category: "STATUS" },
    { name: "LEAD DESCARTADO", category: "STATUS" },
    // CASO
    { name: "SALÁRIO MATERNIDADE", category: "CASO" },
    { name: "TRABALHISTA", category: "CASO" },
    { name: "AUX ACIDENTE", category: "CASO" },
    { name: "BPC IDOSO", category: "CASO" },
    { name: "PENSÃO POR MORTE", category: "CASO" },
    { name: "AUX DOENÇA", category: "CASO" },
    { name: "BPC DEFICIENTE", category: "CASO" },
    { name: "APOSENTADORIA", category: "CASO" },
    // MOTIVO_DESCARTE
    { name: "(DESCARTADO) MOTIVO: JÁ TEM ADVOGADO", category: "MOTIVO_DESCARTE" },
    { name: "(DESCARTADO) MOTIVO: ACHOU CARO", category: "MOTIVO_DESCARTE" },
    { name: "(DESCARTADO) MOTIVO: SUMIU", category: "MOTIVO_DESCARTE" },
    { name: "(DESCARTADO) MOTIVO: NÃO TEM DIREITO", category: "MOTIVO_DESCARTE" },
    { name: "(DESCARTADO) MOTIVO: FOI COM OUTRO ESCRITÓRIO", category: "MOTIVO_DESCARTE" },
    { name: "(DESCARTADO) MOTIVO: DESISTIU", category: "MOTIVO_DESCARTE" },
    { name: "(DESCARTADO) MOTIVO: NÚMERO ERRADO", category: "MOTIVO_DESCARTE" },
    { name: "(DESCARTADO) MOTIVO: OUTRO", category: "MOTIVO_DESCARTE" },
  ];

  await db.insert(tagsTable).values(tags).onConflictDoNothing();
  console.log("✅ Tags inseridas");

  console.log("🎉 Seed concluído!");
  process.exit(0);
}

seed().catch(err => {
  console.error("❌ Erro no seed:", err);
  process.exit(1);
});
