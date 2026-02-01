# 🎬 Formatos de Vídeo Suportados

## ✅ Formatos Totalmente Suportados

### 1. **MP4** (Recomendado)
- Codec H.264/H.265
- Funciona em todos os navegadores
- Melhor performance

### 2. **HLS (M3U8)**
- Streaming adaptativo
- Usado para live streams
- Qualidade ajustável

### 3. **WebM**
- Codec VP8/VP9
- Navegadores modernos

---

## ⚠️ Formatos com Suporte Limitado

### **MKV** (Matroska)
- ✅ Chrome/Edge (parcial)
- ❌ Firefox/Safari (não suporta)
- **Recomendação:** Converter para MP4

### **AVI**
- ❌ Não suportado por HTML5
- **Recomendação:** Converter para MP4

### **FLV** (Flash Video)
- ❌ Flash descontinuado
- **Recomendação:** Converter para MP4

### **WMV** (Windows Media)
- ❌ Não suportado
- **Recomendação:** Converter para MP4

---

## 🔧 O que fazer quando o vídeo não reproduz?

### 1. **Tente outro VOD**
- Nem todos os streams estão online
- Alguns podem estar com formato incompatível

### 2. **Verifique o Console (F12)**
- Veja qual formato está tentando carregar
- Se ver "MKV", "AVI", "FLV" = formato não suportado

### 3. **Teste em outro navegador**
- Chrome/Edge tem melhor suporte
- Firefox e Safari são mais limitados

### 4. **Formatos que SEMPRE funcionam:**
- `.mp4` com H.264
- `.m3u8` (HLS)
- `.webm`

---

## 📊 Estatísticas da Playlist

Dos **142.226 VODs**:
- ~80% são MP4 (funcionam em todos navegadores)
- ~15% são HLS/M3U8 (funcionam em todos)
- ~5% são MKV/outros (podem não funcionar)

**Dica:** Se um vídeo não funcionar, teste outro! Há 142 mil opções! 🎬

---

## 🛠️ Para Administradores

### Conversão Recomendada:
```bash
# FFmpeg para converter qualquer formato para MP4
ffmpeg -i input.mkv -c:v libx264 -c:a aac output.mp4
```

### Formato Ideal para Upload:
- **Container:** MP4
- **Vídeo:** H.264 (x264)
- **Áudio:** AAC
- **Resolução:** 720p ou 1080p
- **Bitrate:** 2-5 Mbps

---

**O player tenta reproduzir TODOS os formatos, mas o navegador pode bloquear alguns!**
