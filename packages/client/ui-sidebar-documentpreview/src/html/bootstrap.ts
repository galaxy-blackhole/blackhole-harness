/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dung tai lieu iframe ngoai: mot bootstrap co dinh, khong callback Host nao vao trong do
 */

import { decodeText, encodeText } from "./bytes.ts";

/** Mot phu thuoc tinh cua tai lieu HTML. */
export interface HtmlAsset {
  /** Loai: 'script' hoac 'stylesheet'. */
  kind: string;
  /** Tham chieu nguyen van trong tai lieu. */
  reference: string;
  /** Byte cua tep phu thuoc. */
  data: Uint8Array;
}

/** Goi byte day du cua mot tai lieu HTML kem phu thuoc tinh. */
export interface HtmlBundle {
  /** Byte HTML day du. */
  data: Uint8Array;
  /** Cac phu thuoc tinh da dong goi. */
  assets: readonly HtmlAsset[];
}

/**
 * Dung tai lieu iframe ngoai. URL tai nguyen duoc tao BEN TRONG sandbox,
 * vi goc mo duc do khong nap duoc URL do trang cha tao.
 * Nhan: bundle — byte HTML day du va cac phu thuoc tinh tuy chon.
 * Tra: HTML bootstrap; UTF-8 khong hop le thi nem truoc khi dieu huong.
 */
export function createHtmlDocument(bundle: HtmlBundle): string {
  const payload = encodeText(JSON.stringify({
    html: decodeText(bundle.data),
    assets: bundle.assets.map((asset) => ({ kind: asset.kind, reference: asset.reference, text: decodeText(asset.data) })),
  }));
  return "<!doctype html><meta charset=\"utf-8\"><script>(()=>{\n" +
    "const bytes=data=>Uint8Array.from(atob(data),character=>character.charCodeAt(0));\n" +
    "const text=data=>new TextDecoder('utf-8',{fatal:true}).decode(bytes(data));\n" +
    "const bundle=JSON.parse(text(\"" + payload + "\"));\n" +
    "let html=bundle.html;\n" +
    "if(bundle.assets.length){\n" +
    "  const parsed=new DOMParser().parseFromString(html,'text/html');\n" +
    "  for(const asset of bundle.assets){\n" +
    "    const script=asset.kind==='script';\n" +
    "    const url=URL.createObjectURL(new Blob([asset.text],{type:script?'application/javascript':'text/css'}));\n" +
    "    const attribute=script?'src':'href';\n" +
    "    for(const element of parsed.querySelectorAll(script?'script[src]':'link[rel~=\"stylesheet\" i][href]')){\n" +
    "      if(element.getAttribute(attribute)===asset.reference)element.setAttribute(attribute,url);\n" +
    "    }\n" +
    "  }\n" +
    "  html='<!doctype html>'+parsed.documentElement.outerHTML;\n" +
    "}\n" +
    "document.open();document.write(html);document.close();\n" +
    "})()<\/script>";
}
