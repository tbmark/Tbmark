# TBMark — Protótipo

Protótipo navegável do app do cliente (busca, agendamento e pagamento) para o
aplicativo de agendamento de clínicas e estúdios de beleza.

## Rodar localmente

```bash
npm install
npm run dev
```

Abra o endereço mostrado no terminal (geralmente http://localhost:5173).

## Gerar versão de produção

```bash
npm run build
```

Isso cria a pasta `dist/` com os arquivos prontos para publicar em qualquer
hospedagem estática (Hostinger, Vercel, Netlify, etc).

## Publicar no GitHub + Hostinger

1. Crie um repositório novo no GitHub.
2. Dentro desta pasta, rode:
   ```bash
   git init
   git add .
   git commit -m "primeira versao do prototipo"
   git remote add origin <link do seu repositório>
   git push -u origin main
   ```
3. No hPanel da Hostinger, use "Importar Git", conecte sua conta do GitHub e
   selecione este repositório. Comando de build: `npm run build`. Pasta de
   saída: `dist`.

## Aviso importante

Este é apenas o **protótipo visual** do fluxo do cliente — dados fictícios,
sem backend, banco de dados ou processamento real de pagamento. Ainda não é
um app publicável nas lojas (App Store / Google Play); para isso, o caminho
técnico muda para React Native (ou Flutter) mais um backend.
