# 🔧 Guia para Administrador - Ativação de Assinaturas

## ⚠️ Problema: Pagamento aprovado mas assinatura não ativa

Se um cliente pagar via PIX mas a assinatura não for ativada automaticamente, use uma das soluções abaixo:

---

## ✅ Solução 1: Botão no Admin Dashboard (MAIS FÁCIL)

1. **Acesse o Admin**
   - Login: giovanepires17@hotmail.com
   - Senha: admin123
   - URL: https://streamflix-3916.preview.emergentagent.com/admin

2. **Vá para a Aba "Usuários"**
   - Clique em "Usuários" no topo

3. **Clique em "Corrigir Assinaturas Agora"**
   - Botão amarelo no topo da página
   - Confirme a ação
   - Sistema busca TODOS os pagamentos APPROVED
   - Ativa automaticamente as assinaturas inativas
   - Mostra quantos foram corrigidos

4. **Resultado:**
   ```
   ✅ X assinaturas corrigidas!
   ✅ Y já estavam ativas.
   ```

---

## ✅ Solução 2: Script Manual (Terminal/SSH)

```bash
cd /app
node scripts/fix-subscriptions.js
```

**O que faz:**
- Busca todos os pagamentos com status APPROVED
- Verifica se a assinatura está ativa
- Se não estiver, ativa por 30 dias automaticamente
- Mostra log de cada usuário corrigido

---

## 🔍 Como Verificar se Funcionou

### Via Admin Dashboard:
1. Acesse Admin > Usuários
2. Procure o email do cliente
3. Coluna "Assinatura" deve mostrar: **ACTIVE** (verde)
4. Coluna "Válida até" deve mostrar a data (30 dias no futuro)

### Via API:
```bash
curl http://localhost:3000/api/admin/users \
  -H "Cookie: accessToken=SEU_TOKEN_ADMIN"
```

---

## 🎯 Por Que Isso Acontece?

### Webhook do Mercado Pago pode falhar por:
1. **Timeout na rede**
2. **Erro temporário no servidor**
3. **Webhook não configurado corretamente**
4. **Evento de teste** (não ativa assinatura propositalmente)

### Solução Permanente:
1. Verifique se o webhook está configurado no painel do Mercado Pago
2. URL: `https://streamflix-3916.preview.emergentagent.com/api/webhooks/mercadopago`
3. Evento: Apenas "Pagamentos"
4. Chave secreta: Configure a MP_WEBHOOK_SECRET

---

## 📊 Logs do Webhook

Para ver se o webhook está sendo chamado:

```bash
# Ver logs do servidor
tail -f /var/log/supervisor/nextjs.out.log | grep "Webhook"
```

**O que procurar:**
```
🔔 Webhook received: {...}
✅ Signature validated
💾 Event saved
📦 MP Payment: {...}
💳 Local payment found: {...}
✅ Payment APPROVED! Activating subscription...
🎉 Subscription activated!
```

Se não ver esses logs após pagamento = webhook não está sendo chamado!

---

## 🚨 Casos Especiais

### Cliente pagou mas webhook nunca chegou:
1. Use o botão "Corrigir Assinaturas" no admin
2. OU execute o script manualmente
3. Sistema ativa automaticamente

### Cliente pagou 2x mas só 1 assinatura ativa:
- Sistema estende a assinatura automaticamente
- Se pagou 2x, deve ter 60 dias (não 30)
- Se não tiver, use "Corrigir Assinaturas"

### Cliente quer reembolso mas assinatura já ativa:
1. No admin, você pode ver o pagamento
2. Se precisar suspender: vá no banco de dados
3. Ou crie endpoint admin para suspender manualmente

---

## 🛠️ Comandos Úteis

### Listar todos os usuários e status:
```bash
cd /app
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findMany({
  include: { subscription: true, payments: true }
}).then(users => {
  users.forEach(u => {
    console.log(\`\${u.email}: \${u.subscription?.status} até \${u.subscription?.endAt}\`);
  });
  prisma.\$disconnect();
});
"
```

### Ver todos os pagamentos APPROVED:
```bash
cd /app
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.payment.findMany({
  where: { status: 'APPROVED' },
  include: { user: true }
}).then(payments => {
  payments.forEach(p => {
    console.log(\`\${p.user.email}: R$ \${p.amount} - \${p.status}\`);
  });
  prisma.\$disconnect();
});
"
```

---

## ✅ Checklist de Troubleshooting

- [ ] Cliente realmente pagou? (verificar no Mercado Pago)
- [ ] Pagamento está como APPROVED no admin?
- [ ] Webhook está configurado no Mercado Pago?
- [ ] URL do webhook está correta?
- [ ] Tentou clicar "Corrigir Assinaturas"?
- [ ] Verificou os logs do servidor?
- [ ] Assinatura foi ativada mas usuário não consegue assistir?
  - Peça para fazer logout e login novamente
  - Limpar cache do navegador

---

## 🎬 Fluxo Normal (Quando Tudo Funciona)

1. Cliente cria conta
2. Cliente vai em /checkout/pix
3. Sistema gera QR Code
4. Cliente paga via PIX no banco
5. **Mercado Pago envia webhook**
6. **Sistema recebe webhook**
7. **Sistema consulta API do MP**
8. **Sistema atualiza payment para APPROVED**
9. **Sistema ativa assinatura por 30 dias**
10. Cliente pode assistir!

**Se falhar no passo 5-9:** Use "Corrigir Assinaturas"!

---

## 📞 Suporte

Se nada disso resolver:
1. Verifique os logs: `tail -f /var/log/supervisor/nextjs.out.log`
2. Verifique o banco: Status do payment e subscription
3. Execute script de correção
4. Contate suporte técnico

---

**Resumo:** Use o botão "Corrigir Assinaturas" no Admin sempre que um cliente pagar mas não conseguir assistir! 🚀
