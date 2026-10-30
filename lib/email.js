/* =====================================================================================
   E-MAIL — envio pelo SMTP de uma caixa da Amorim (nodemailer)
   -------------------------------------------------------------------------------------
   Usado pela ficha do onboarding (api/ficha.js). O Bitrix não tem método REST para mandar
   e-mail para um endereço qualquer, por isso o servidor envia direto pela caixa configurada.
   (Os e-mails dos funis de vagas e de offboarding são automação do próprio Bitrix desde 30/10/2026.)

   Variáveis de ambiente na Vercel:
     SMTP_HOST        servidor SMTP (ex.: mail.amorimglobal.com, smtp.gmail.com)
     SMTP_PORTA       opcional, padrão 465 (SSL). 587 usa STARTTLS
     SMTP_USUARIO     login da caixa (o e-mail completo)
     SMTP_SENHA       senha da caixa (ou senha de app, no Google)
     EMAIL_REMETENTE  opcional: endereço do remetente, se for diferente do login
                      (alguns servidores só aceitam o próprio login como remetente)
   ===================================================================================== */
"use strict";
const nodemailer = require("nodemailer");

const OBRIGATORIAS = ["SMTP_HOST", "SMTP_USUARIO", "SMTP_SENHA"];
const NOME_REMETENTE = "Gestão de Pessoas · Amorim";

const tem = (env, v) => !!String((env || {})[v] || "").trim();
/** Variáveis de e-mail que faltam (lista vazia = configurado) */
function emailConfigurado(env) { return OBRIGATORIAS.filter((v) => !tem(env, v)); }

/** "rh@x.com" -> "Gestão de Pessoas · Amorim" <rh@x.com>; quem já veio com nome fica como está */
function remetente(env) {
  const end = String(env.EMAIL_REMETENTE || env.SMTP_USUARIO || "").trim();
  return /</.test(end) ? end : '"' + NOME_REMETENTE + '" <' + end + ">";
}

const EMAIL_VALIDO = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;
function emailValido(e) { return EMAIL_VALIDO.test(String(e || "").trim()); }

/** env: as variáveis acima. transporteInjetado: {sendMail} nos testes. */
function criarEmail(env, transporteInjetado) {
  const falta = emailConfigurado(env);
  if (falta.length && !transporteInjetado) throw new Error("e-mail não configurado na Vercel: falta " + falta.join(", "));
  const porta = Number(env.SMTP_PORTA || 465);
  const transporte = transporteInjetado || nodemailer.createTransport({
    host: String(env.SMTP_HOST).trim(), port: porta, secure: porta === 465,
    auth: { user: String(env.SMTP_USUARIO).trim(), pass: String(env.SMTP_SENHA) },
  });
  return {
    /** Devolve a resposta do servidor (ex.: "250 OK id=..."), que vai para o log como prova da entrega */
    async enviar({ para, assunto, html, texto, responderPara }) {
      if (!emailValido(para)) throw new Error("endereço de e-mail inválido: " + String(para || "(vazio)"));
      const msg = { from: remetente(env), to: String(para).trim(), subject: assunto, text: texto, html };
      if (emailValido(responderPara)) msg.replyTo = String(responderPara).trim();
      const info = await transporte.sendMail(msg);
      return String((info && info.response) || "");
    },
  };
}

module.exports = { emailConfigurado, criarEmail, emailValido, remetente, OBRIGATORIAS };
