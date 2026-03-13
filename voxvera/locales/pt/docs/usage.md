# Uso Detalhado

Este guia cobre os fluxos de trabalho comuns da CLI. Veja `docs/docker.md` para instruções do Docker e `docs/templates.md` para modelos de panfletos disponíveis.

## Pré-requisitos

O VoxVera foi projetado para ser altamente portátil e requer dependências mínimas do sistema.

### 1. Binários Independentes (Recomendado)
Você pode baixar binários independentes e sem dependências para o seu sistema operacional:
- **Linux:** `voxvera-linux`
- **Windows:** `voxvera-windows.exe`
- **macOS:** `voxvera-macos`

Estes binários incluem tudo o que é necessário para executar o VoxVera (exceto o `onionshare-cli`).

### 2. Instalador de Linha Única
Alternativamente, instale através do nosso script automatizado:

```bash
curl -fsSL https://raw.githubusercontent.com/PR0M3TH3AN/VoxVera/main/install.sh | bash
```

### 3. Instalação Manual via Python
Se preferir executar a partir do código-fonte:

```bash
pipx install 'voxvera@git+https://github.com/PR0M3TH3AN/VoxVera.git@main'
sudo apt install tor onionshare-cli   # Debian/Ubuntu
```

## Passo a Passo

1. **Inicializar:** Execute `voxvera init` e siga as instruções. Você será solicitado a selecionar seu idioma primeiro.
2. **Construir:** Gere os arquivos do panfleto. Cada construção cria automaticamente um `voxvera-portable.zip` na pasta do panfleto, permitindo que outros baixem a ferramenta completa diretamente do seu panfleto.
   ```bash
   voxvera build
   ```
3. **Servir:** Publique o panfleto via Tor:
   ```bash
   voxvera serve
   ```
   Isso detecta automaticamente sua instância do Tor, inicia o OnionShare e escreve o endereço .onion gerado nos links destacáveis do panfleto.

## Suporte a Idiomas

O VoxVera é totalmente localizado. Você pode alterar sua preferência de idioma permanentemente usando o seletor interativo ou um atalho direto:

- **Seletor Interativo:** `voxvera lang`
- **Atalho Direto:** `voxvera --lang pt` (define a preferência para português)

### Idiomas Suportados:
- **Inglês:** `en`
- **Espanhol:** `es` (alias: `--idioma`)
- **Alemão:** `de` (alias: `--sprache`)
- **Português:** `pt`

Você também pode forçar um idioma específico para um único comando sem alterar sua preferência permanente:
- **Inglês:** `voxvera --lang en check`
- **Português:** `voxvera --lang pt check`

Os panfletos gerados detectam automaticamente o idioma do navegador do visitante e alteram o texto da interface adequadamente.

## Gerenciamento de Servidores

Gerencie vários panfletos e suas identidades Tor a partir de um único menu interativo:

```bash
voxvera manage
```

Recursos:
- **{{t('cli.manage_create_new')}}**: Inicia a sequência completa de configuração.
- **{{t('cli.manage_start_all')}}**: Inicia ou encerra todos os panfletos da sua frota de uma só vez.
- **Status em Tempo Real**: Visualize URLs .onion ativas e indicadores de progresso de inicialização do Tor.
- **Controle Individual**: {{t('cli.manage_action_export')}} sites específicos para ZIP ou exclua-os.

## Espelhamento Universal (Distribuição Viral)

Para garantir que o VoxVera permaneça acessível mesmo se os repositórios centrais forem censurados, cada panfleto atua como um espelho para a ferramenta.

Quando você hospeda um panfleto, o botão **"{{t('web.download_button')}}"** na página inicial fornece um `voxvera-portable.zip` contendo:
- O código-fonte completo e todos os idiomas suportados.
- Todas as dependências Python (pré-vendidas).
- Binários Tor multiplataforma.

Isso permite que qualquer pessoa que escaneie seu panfleto se torne um novo distribuidor da ferramenta VoxVera.

## Exportação e Backup

Faça backup de suas identidades Tor exclusivas (para que sua URL .onion nunca mude) ou mova seus panfletos para outra máquina.

- **Exportar um único site**: `voxvera export <nome_da_pasta>`
- **Exportar todos os sites**: `voxvera export-all`

**Local de armazenamento:** Todas as exportações são salvas como arquivos ZIP em uma pasta chamada `voxvera-exports` no diretório inicial do usuário (`~/voxvera-exports/`) em todas as plataformas.

## Importação e Recuperação

Restaure toda a sua configuração em uma nova máquina movendo seus arquivos ZIP para `~/voxvera-exports/` e executando:

```bash
voxvera import-multiple
```

## Portabilidade e Uso Offline

Se precisar executar o VoxVera em uma máquina sem acesso à internet, você pode "venderizar" as dependências primeiro:

```bash
voxvera vendorize
```

Isso baixa todas as bibliotecas Python necessárias para `voxvera/vendor/`. A ferramenta priorizará esses arquivos locais, permitindo que ela funcione sem `pip install`.

## Importação em Lote (JSON)

Para gerar panfletos em massa a partir de vários arquivos de configuração JSON, coloque-os no diretório `imports/` e execute:

```bash
voxvera batch-import
```

## Como as URLs Funcionam

Cada panfleto tem duas URLs separadas:
- **Link destacável** (gerado automaticamente): O endereço .onion onde o panfleto está hospedado.
- **Link de conteúdo** (configurado pelo usuário): Uma URL externa apontando para um site, vídeo ou download.

Você não precisa inserir manualmente o endereço .onion; o VoxVera lida com isso automaticamente durante a fase de `serve`.
