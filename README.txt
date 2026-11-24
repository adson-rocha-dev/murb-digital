CENTRAL OPERACIONAL V8 - MANUTENÇÃO DE VIAS EXCLUSIVA

Dashboard e geolocalização V19. Menus antigos removidos.
Supabase: autenticação real e leitura do backup Johnson se disponível à conta.
A contagem de ativos só é exibida quando o backup fornece dados verificáveis.
Programações ainda são locais e não sincronizam com Supabase.
Abra a nuvem na barra superior para gerenciar a conexão.
Publique em HTTPS para utilizar GPS.

V11: datas no formato brasileiro, programacoes em ordem cronologica e copia organizada para WhatsApp.

V20: aceita links compartilhados maps.app.goo.gl com parametro g_st; referencias dos recursos versionadas para evitar JS antigo em cache.

V21: corrige conflito da constante URL do Supabase com construtor URL nativo.

V22: Marco Inicial em 23/11/2026; primeira semana 23-28/11. Registros locais anteriores arquivados em central_vias_pre_marco_archive_v22; importacao V19 ignora datas anteriores. Supabase nao alterado.

V23: painel de conexão único na barra; formulário de login incorporado; abre/fecha pela nuvem, X, Escape ou toque fora; sem formulário no dashboard.

V24: agrupamento por data e endereco mesmo com areas diferentes; filtro de area preserva grupo inteiro.

V27: abertura no topo com três modos visíveis, sincronização com resultado explícito, botões de links operantes e atualização dos grupos de equipes. Links curtos sujeitos a restrição CORS do Google.

V28: botão Mapa substituído por Geolocalização, abrindo diretamente a Central V19; removido botão flutuante.

V29: o link maps.app.goo.gl/Hx73ZhfcVWuAiRFNA (com ou sem g_st=ac) é associado às coordenadas verificadas -3.1139315,-60.0364438. Demais links encurtados não são inventados; dependem de resolução acessível ou localização manual. Não altera a interface V28.

V30: consulta /api/resolve-google-map na mesma origem. É necessário publicar o Cloudflare Worker incluído separadamente, com rota /api/resolve-google-map*, mantendo a hospedagem estática existente. O Worker segue redirecionamentos permitidos e extrai coordenadas quando o Google as disponibiliza. Não há garantia de que todo link curto exponha coordenadas. Nenhum ponto é inventado.

V33 — Localização assistida gratuita: na aba Links do painel, para locais sem coordenadas, abra o link, clique Confirmar ponto manualmente, toque no mapa e confirme. As coordenadas são gravadas na programação local, mantendo o link original. Nenhuma API paga.
