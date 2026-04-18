/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface LojistaInviteProps {
  empresaNome?: string
  lojistaNome?: string
  acceptUrl?: string
}

const LojistaInviteEmail = ({
  empresaNome = 'AssistPro',
  lojistaNome = 'Parceiro',
  acceptUrl = '#',
}: LojistaInviteProps) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>
      {empresaNome} convidou você para o Portal Lojista
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Você foi convidado!</Heading>
        <Text style={text}>
          A <strong>{empresaNome}</strong> convidou{' '}
          <strong>{lojistaNome}</strong> para acessar o Portal Lojista
          como parceiro comercial.
        </Text>
        <Text style={text}>Como parceiro, você poderá:</Text>
        <Section style={list}>
          <Text style={listItem}>• Acompanhar aparelhos em reparo</Text>
          <Text style={listItem}>• Ver orçamentos e histórico de serviços</Text>
          <Text style={listItem}>• Receber notificações automáticas</Text>
        </Section>
        <Section style={buttonWrapper}>
          <Button style={button} href={acceptUrl}>
            Aceitar convite e acessar o portal
          </Button>
        </Section>
        <Text style={footer}>
          Este link expira em 7 dias. Se você não esperava este convite,
          pode ignorar este email com segurança.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: LojistaInviteEmail,
  subject: (data: Record<string, any>) =>
    `${data?.empresaNome ?? 'AssistPro'} convidou você para o Portal Lojista`,
  displayName: 'Convite Lojista',
  previewData: {
    empresaNome: 'MobileFix',
    lojistaNome: 'Loja Centro',
    acceptUrl: 'https://mobilefix.dev/lojista/aceitar-convite?token=preview',
  },
} satisfies TemplateEntry

export default LojistaInviteEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Inter', Arial, sans-serif",
}
const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px',
}
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#1a2236',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#4b5563',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const list = { margin: '0 0 24px' }
const listItem = {
  fontSize: '14px',
  color: '#4b5563',
  lineHeight: '1.8',
  margin: '0',
}
const buttonWrapper = { textAlign: 'center' as const, margin: '28px 0' }
const button = {
  backgroundColor: '#2563d4',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '10px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: '24px 0 0',
  lineHeight: '1.5',
}
