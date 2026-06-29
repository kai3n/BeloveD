#!/usr/bin/env python3
import csv
import json
import re
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
DOWNLOADS = Path("/Users/mingunpak/Downloads")
OUT = ROOT / "src" / "lib" / "styleSeedData.js"

CSV = {
    "bracelets": DOWNLOADS / "Style - Bracelets.csv",
    "bands": DOWNLOADS / "Style - Bands.csv",
    "engagement": DOWNLOADS / "Style - Engagement Rings.csv",
    "necklaces": DOWNLOADS / "Style - Necklaces & Pendants.csv",
    "earrings": DOWNLOADS / "Style - Earrings.csv",
}

TRANSLATIONS = {
    "Four-Prong Solitaire Ring": {
        "ko": "4프롱 솔리테어 링",
        "zh": "四爪单钻戒",
        "es": "Anillo solitario de 4 garras",
    },
    "Six-Prong Halo Ring": {
        "ko": "6프롱 헤일로 링",
        "zh": "六爪光环钻戒",
        "es": "Anillo halo de 6 garras",
    },
    "Cathedral Six-Prong Solitaire Ring": {
        "ko": "캐시드럴 6프롱 솔리테어 링",
        "zh": "大教堂六爪单钻戒",
        "es": "Anillo solitario catedral de 6 garras",
    },
    "Double-Claw Three-Stone Ring": {
        "ko": "더블 클로 쓰리 스톤 링",
        "zh": "双爪三石钻戒",
        "es": "Anillo de tres piedras con doble garra",
    },
    "Hidden Halo Side-Stone Ring": {
        "ko": "히든 헤일로 사이드 스톤 링",
        "zh": "隐藏光环侧石钻戒",
        "es": "Anillo con halo oculto y piedras laterales",
    },
    "Toi et Moi Ring": {
        "ko": "투아 에 무아 링",
        "zh": "双主石戒指",
        "es": "Anillo Toi et Moi",
    },
    "Double-Row Side-Stone Halo Ring": {
        "ko": "더블 로우 사이드 스톤 헤일로 링",
        "zh": "双排侧石光环钻戒",
        "es": "Anillo halo con doble fila lateral",
    },
    "Bold Bezel Solitaire Ring": {
        "ko": "볼드 베젤 솔리테어 링",
        "zh": "宽边包镶单钻戒",
        "es": "Anillo solitario bisel bold",
    },
    "Six-Prong Solitaire Ring": {
        "ko": "6프롱 솔리테어 링",
        "zh": "六爪单钻戒",
        "es": "Anillo solitario de 6 garras",
    },
    "Round Halo Engagement Ring": {
        "ko": "라운드 헤일로 약혼반지",
        "zh": "圆形光环订婚戒指",
        "es": "Anillo de compromiso halo redondo",
    },
    "Emerald Hidden Halo Engagement Ring": {
        "ko": "에메랄드 히든 헤일로 약혼반지",
        "zh": "祖母绿形隐藏光环订婚戒指",
        "es": "Anillo de compromiso halo oculto esmeralda",
    },
    "Round Three-Stone Ring": {
        "ko": "라운드 쓰리 스톤 링",
        "zh": "圆形三石戒指",
        "es": "Anillo de tres piedras redondas",
    },
    "Cushion Double-Row Side-Stone Halo Ring": {
        "ko": "쿠션 더블 로우 사이드 스톤 헤일로 링",
        "zh": "垫形双排侧石光环戒指",
        "es": "Anillo halo cushion con doble fila lateral",
    },
    "Low Four-Prong Solitaire Ring": {
        "ko": "로우 4프롱 솔리테어 링",
        "zh": "低款四爪单钻戒",
        "es": "Anillo solitario bajo de 4 garras",
    },
    "Halo Ring": { "ko": "헤일로 링", "zh": "光环钻戒", "es": "Anillo halo" },
    "Hidden Halo Ring": {
        "ko": "히든 헤일로 링",
        "zh": "隐藏光环钻戒",
        "es": "Anillo con halo oculto",
    },
    "Three-Stone Ring": {
        "ko": "쓰리 스톤 링",
        "zh": "三石钻戒",
        "es": "Anillo de tres piedras",
    },
    "Side-Stone Ring": {
        "ko": "사이드 스톤 링",
        "zh": "侧石钻戒",
        "es": "Anillo con piedras laterales",
    },
    "The One Ring": { "ko": "더 원 링", "zh": "The One 戒指", "es": "Anillo The One" },
    "Shared-Prong Diamond Eternity Band": {
        "ko": "쉐어드 프롱 다이아 이터니티 밴드",
        "es": "Banda eternity de diamantes compartidos",
    },
    "Shared-Prong Eternity Band": {
        "ko": "쉐어드 프롱 이터니티 밴드",
        "es": "Banda eternity compartida",
    },
    "Twisted Chevron Diamond Band": {
        "ko": "트위스트 쉐브론 다이아 밴드",
        "es": "Banda chevron trenzada con diamantes",
    },
    "V-Shaped Diamond Band": {
        "ko": "V 쉐이프 다이아 밴드",
        "es": "Banda de diamantes en V",
    },
    "Pavé Band": { "ko": "파베 밴드", "es": "Banda pavé" },
    "French Pavé Wedding Band": {
        "ko": "프렌치 파베 웨딩 밴드",
        "zh": "法式密钉婚戒",
        "es": "Banda de boda pavé francés",
    },
    "Channel Set Band": { "ko": "채널 세트 밴드", "es": "Banda channel set" },
    "Channel-Set Eternity Band": {
        "ko": "채널 세트 이터니티 밴드",
        "zh": "槽镶永恒戒",
        "es": "Banda eternity channel set",
    },
    "Tennis Bracelet": { "ko": "테니스 브레이슬릿", "es": "Pulsera tenis" },
    "Four-Prong Tennis Bracelet": {
        "ko": "4프롱 테니스 브레이슬릿",
        "zh": "四爪网球手链",
        "es": "Pulsera tenis de 4 garras",
    },
    "Diamond Bangle": { "ko": "다이아몬드 뱅글", "es": "Brazalete de diamantes" },
    "Shared-Prong Bangle Bracelet": {
        "ko": "쉐어드 프롱 뱅글 브레이슬릿",
        "zh": "共爪手镯",
        "es": "Brazalete de garras compartidas",
    },
    "Station Bracelet": { "ko": "스테이션 브레이슬릿", "es": "Pulsera station" },
    "Beveled X Tennis Bracelet": {
        "ko": "베벨드 X 테니스 브레이슬릿",
        "zh": "斜面 X 网球手链",
        "es": "Pulsera tenis Beveled X",
    },
    "Graduated / Journey Bracelet": {
        "ko": "그라데이티드 저니 브레이슬릿",
        "es": "Pulsera graduada Journey",
    },
    "Station": { "ko": "스테이션 브레이슬릿", "es": "Pulsera station" },
    "Solitaire Pendant": { "ko": "솔리테어 펜던트", "es": "Colgante solitario" },
    "Round Solitaire Pendant": {
        "ko": "라운드 솔리테어 펜던트",
        "zh": "圆形单钻吊坠",
        "es": "Colgante solitario redondo",
    },
    "Halo Pendant": { "ko": "헤일로 펜던트", "es": "Colgante halo" },
    "Round Halo Pendant": {
        "ko": "라운드 헤일로 펜던트",
        "zh": "圆形光环吊坠",
        "es": "Colgante halo redondo",
    },
    "Clover Pendant": { "ko": "클로버 펜던트", "es": "Colgante trébol" },
    "Cluster Flower Pendant": {
        "ko": "클러스터 플라워 펜던트",
        "zh": "簇镶花朵吊坠",
        "es": "Colgante floral cluster",
    },
    "Graduated Necklace": { "ko": "그라데이티드 네크리스", "es": "Collar graduado" },
    "Thirteen-Stone Demi Eternity Necklace": {
        "ko": "13스톤 데미 이터니티 네크리스",
        "zh": "十三石半圈永恒项链",
        "es": "Collar demi eternity de trece piedras",
    },
    "Journey Necklace": { "ko": "저니 네크리스", "es": "Collar Journey" },
    "Round and Pear Diamond Drop Necklace": {
        "ko": "라운드 앤 페어 다이아 드롭 네크리스",
        "zh": "圆形与梨形钻石垂坠项链",
        "es": "Collar colgante de diamantes redondos y pera",
    },
    "Butterfly Pendant": { "ko": "버터플라이 펜던트", "es": "Colgante mariposa" },
    "Marquise Pear Flower Pendant": {
        "ko": "마퀴즈 페어 플라워 펜던트",
        "zh": "马眼形梨形花朵吊坠",
        "es": "Colgante floral marquise y pera",
    },
    "Tennis Necklace": { "ko": "테니스 네크리스", "es": "Collar tenis" },
    "Four-Prong Tennis Necklace": {
        "ko": "4프롱 테니스 네크리스",
        "zh": "四爪网球项链",
        "es": "Collar tenis de 4 garras",
    },
    "Station Necklace": { "ko": "스테이션 네크리스", "es": "Collar station" },
    "Cross Pendant": { "ko": "크로스 펜던트", "es": "Colgante cruz" },
    "Diamond Cross Pendant": {
        "ko": "다이아몬드 크로스 펜던트",
        "zh": "钻石十字吊坠",
        "es": "Colgante cruz de diamantes",
    },
    "Statement Cross Pendant": { "ko": "스테이트먼트 크로스 펜던트", "es": "Colgante cruz statement" },
    "Shield Diamond Cross Statement Pendant": {
        "ko": "쉴드 다이아몬드 크로스 스테이트먼트 펜던트",
        "zh": "盾形钻石十字宣言吊坠",
        "es": "Colgante cruz statement con diamante shield",
    },
    "Solitaire Studs": { "ko": "솔리테어 스터드", "zh": "单钻耳钉", "es": "Aretes solitario" },
    "Round Diamond Stud Earrings": {
        "ko": "라운드 다이아몬드 스터드 이어링",
        "zh": "圆形钻石耳钉",
        "es": "Aretes de diamantes redondos",
    },
    "Diamond Hoops": { "ko": "다이아몬드 후프", "zh": "钻石圈圈耳圈", "es": "Aros de diamantes" },
    "Inside-Out Hoop Earrings": {
        "ko": "인사이드 아웃 후프 이어링",
        "zh": "内外镶钻圈形耳环",
        "es": "Aros inside-out",
    },
    "Halo Studs": { "ko": "헤일로 스터드", "zh": "光环耳钉", "es": "Aretes halo" },
    "Princess Halo Stud Earrings": {
        "ko": "프린세스 헤일로 스터드 이어링",
        "zh": "公主方光环耳钉",
        "es": "Aretes halo princess",
    },
    "Huggie Earrings": { "ko": "허기 이어링", "zh": "贴耳小圈钻", "es": "Aros huggie" },
    "Cushion Huggie Hoop Earrings": {
        "ko": "쿠션 허기 후프 이어링",
        "zh": "垫形贴耳圈耳环",
        "es": "Aros huggie cushion",
    },
    "Drop Earrings": { "ko": "드롭 이어링", "zh": "垂坠耳环", "es": "Aretes colgantes" },
    "Emerald Halo Drop Earrings": {
        "ko": "에메랄드 헤일로 드롭 이어링",
        "zh": "祖母绿形光环垂坠耳环",
        "es": "Aretes colgantes halo esmeralda",
    },
    "Journey Earrings": { "ko": "저니 이어링", "zh": "渐变耳环", "es": "Aretes Journey" },
    "Graduated Inside-Out Huggie Hoop Earrings": {
        "ko": "그라데이티드 인사이드 아웃 허기 후프 이어링",
        "zh": "渐变内外镶钻贴耳圈耳环",
        "es": "Aros huggie inside-out graduados",
    },
}

PRODUCT_TITLE_OVERRIDES = {
    "RIGTXR09875R400": "Four-Prong Solitaire Ring",
    "RIGTXR01745": "Cathedral Six-Prong Solitaire Ring",
    "RIGKSR6115R600": "Round Halo Engagement Ring",
    "RIGTXR03183": "Emerald Hidden Halo Engagement Ring",
    "RIGJRD0315": "Round Three-Stone Ring",
    "RIG0894X4C500H1": "Cushion Double-Row Side-Stone Halo Ring",
    "RIGRVR02048": "Bold Bezel Solitaire Ring",
    "RIGTX06263R200": "Low Four-Prong Solitaire Ring",
    "BNGWR4428": "Shared-Prong Diamond Eternity Band",
    "BNGTXR04267": "French Pavé Wedding Band",
    "BNGYR1450K": "Channel-Set Eternity Band",
    "EAGTXE01900": "Round Diamond Stud Earrings",
    "EAGJOE555": "Inside-Out Hoop Earrings",
    "EAGTXE02393": "Princess Halo Stud Earrings",
    "EAGAJE06021": "Cushion Huggie Hoop Earrings",
    "EAGTXE02084": "Emerald Halo Drop Earrings",
    "EARRVE04056": "Graduated Inside-Out Huggie Hoop Earrings",
    "BCGTXBR00769": "Four-Prong Tennis Bracelet",
    "BCGVG2664K": "Shared-Prong Bangle Bracelet",
    "TXBR09965": "Beveled X Tennis Bracelet",
    "PNGTXP07660R300": "Round Solitaire Pendant",
    "PNGTXP01957": "Round Halo Pendant",
    "cluster-diamond-flower-pendant": "Cluster Flower Pendant",
    "NECRN01233R500": "Thirteen-Stone Demi Eternity Necklace",
    "diamond-drop-necklace-with-125-ctw-round-and-pear": "Round and Pear Diamond Drop Necklace",
    "lab-grown-diamond-marquise-pear-cut-flower-pendant": "Marquise Pear Flower Pendant",
    "NECUDN03480": "Four-Prong Tennis Necklace",
    "NECKN29498": "Station Necklace",
    "PENKP0960": "Diamond Cross Pendant",
    "PENJOP7967": "Shield Diamond Cross Statement Pendant",
}

STYLE_MEDIA_OVERRIDES = {
    "Cathedral Six-Prong Solitaire Ring": {
        "ref": "https://www.grownbrilliance.com/1-1-2-ctw-round-lab-grown-diamond-cathedral-six-prong-solitaire-engagement-ring-platinum/pid/RIGTXR01745-PL2",
        "zh": "大教堂六爪单钻戒",
        "images": [
            "https://media.grownbrilliance.com/a2c5372a-e16a-4ea3-b361-da9fdc89a59f/https://images.grownbrilliance.com/productimages/RIGTXR01745/medium/RIGTXR01745-WG-RB-WH-150-M0.jpg",
            "https://media.grownbrilliance.com/a2c5372a-e16a-4ea3-b361-da9fdc89a59f/https://images.grownbrilliance.com/productimages/RIGTXR01745/medium/RIGTXR01745-WG-RB-WH-150-M3.jpg",
        ],
    },
}


def rows(path):
    with path.open(newline="", encoding="utf-8-sig") as f:
        yield from csv.reader(f)


def cell(row, idx):
    return row[idx].strip() if idx < len(row) and row[idx] else ""


def parse_images(value):
    return [part.strip() for part in value.split("|") if part.strip().startswith("http")]


def product_code(url):
    match = re.search(r"/productimages/([^/]+)/", unquote(url))
    return match.group(1) if match else ""


def product_pid(url):
    match = re.search(r"/pid/([^/?#]+)", unquote(url))
    return match.group(1) if match else ""


def product_signature_from_code(code):
    if not code:
        return ""
    groups = re.findall(r"\d{3,}", code)
    return max(groups, key=len) if groups else code


def product_signature(url):
    return product_signature_from_code(product_code(url) or product_pid(url))


def related_product_media(urls, ref=""):
    media = [url for url in urls if url.startswith("http")]
    if not media:
        return []
    ref_signature = product_signature(ref)
    if ref_signature:
        related_to_ref = [url for url in media if product_signature(url) == ref_signature]
        if related_to_ref:
            return related_to_ref
    target_signature = product_signature(media[0])
    if not target_signature:
        return media[:1]
    return [url for url in media if product_signature(url) == target_signature]


def clean_name(value):
    value = re.sub(r"（.*?）", "", value)
    value = re.sub(r"\(.*?\)", "", value)
    return re.sub(r"\s+", " ", value).strip()


def i18n(en, zh=""):
    zh = zh if zh and not zh.startswith("http") else TRANSLATIONS.get(en, {}).get("zh", en)
    data = TRANSLATIONS.get(en, {})
    return {
        "en": en,
        "ko": data.get("ko", en),
        "zh": zh or data.get("zh", en),
        "es": data.get("es", en),
    }


def product_title_for(ref="", images=None):
    haystack = " ".join([ref or "", *(images or [])])
    for marker, title in PRODUCT_TITLE_OVERRIDES.items():
        if marker in haystack:
            return title
    return ""


def detail_copy(category):
    base = {
        "detailLabel": {
            "en": "Custom starter design",
            "ko": "맞춤 시작 디자인",
            "zh": "定制起点设计",
            "es": "Diseño inicial personalizado",
        },
        "description": {
            "en": "This is a sample starting point, not a limit. Share references and we can adjust shape, scale, stones, metal, and finish after review.",
            "ko": "이 디자인은 제한이 아니라 시작점입니다. 원하는 레퍼런스를 보내주시면 형태, 크기, 스톤, 메탈, 마감을 검토 후 조정할 수 있습니다.",
            "zh": "这是起点样例，不是限制。上传参考后，我们可评估并调整造型、尺寸、宝石、金属与细节。",
            "es": "Este diseño es un punto de partida, no un límite. Comparte referencias y ajustamos forma, escala, piedras, metal y acabado tras revisar.",
        },
        "flexibleText": {
            "en": "Shape, stone, metal, scale",
            "ko": "형태, 스톤, 메탈, 크기",
            "zh": "造型、宝石、金属、比例",
            "es": "Forma, piedra, metal, escala",
        },
        "beforeProductionText": {
            "en": "Quote and CAD approval",
            "ko": "견적 및 CAD 승인",
            "zh": "报价与 CAD 确认",
            "es": "Cotización y aprobación CAD",
        },
    }
    if category == "bangle":
        base["flexibleText"]["en"] = "Length, clasp, stone size"
        base["flexibleText"]["ko"] = "길이, 잠금장식, 스톤 크기"
        base["flexibleText"]["zh"] = "长度、扣件、宝石尺寸"
        base["flexibleText"]["es"] = "Largo, broche, tamaño de piedra"
    if category == "necklace":
        base["flexibleText"]["en"] = "Chain, length, pendant scale"
        base["flexibleText"]["ko"] = "체인, 길이, 펜던트 크기"
        base["flexibleText"]["zh"] = "链型、长度、吊坠比例"
        base["flexibleText"]["es"] = "Cadena, largo, escala del colgante"
    if category == "earrings":
        base["flexibleText"]["en"] = "Pairing, post, drop length"
        base["flexibleText"]["ko"] = "페어링, 포스트, 드롭 길이"
        base["flexibleText"]["zh"] = "配对、耳针、垂坠长度"
        base["flexibleText"]["es"] = "Par, poste, largo de caída"
    return base


def subcategory_for(category, name):
    text = name.lower()
    if category == "ring":
        if "band" in text or "eternity" in text or "pavé" in text or "channel" in text or "chevron" in text:
            return "weddingBand"
        if "bezel" in text or "toi et moi" in text or "the one" in text:
            return "statementRing"
        return "engagementRing"
    if category == "earrings":
        if "drop" in text or "journey" in text:
            return "drops"
        if "hoop" in text or "huggie" in text:
            return "huggies"
        return "studs"
    if category == "bangle":
        if "bangle" in text:
            return "bangle"
        if "station" in text or "journey" in text:
            return "chainBracelet"
        return "tennisBracelet"
    if category == "necklace":
        if "tennis" in text:
            return "tennisNecklace"
        if "station" in text or "graduated" in text or "eternity" in text or "demi" in text:
            return "stationNecklace"
        return "pendant"
    return ""


def base_fields(category, name, seq, zh="", ref="", images=None, fallback_key=None):
    defaults = {
        "ring": (4.2, 95, 12, ["18kw", "18ky", "18kr", "pt"]),
        "earrings": (2.4, 80, 10, ["14kw", "14ky", "14kr", "18kw", "18ky"]),
        "bangle": (9.6, 170, 16, ["14kw", "14ky", "18kw", "18ky"]),
        "necklace": (4.2, 85, 12, ["14kw", "14ky", "18kw", "18ky", "pt"]),
    }
    est_weight, labor, lead, metals = defaults[category]
    media = [{"kind": "image", "src": src} for src in (images or [])[:5]]
    if not media:
        return None
    data = {
        "id": seq,
        "category": category,
        "subcategory": subcategory_for(category, name),
        "coverImage": media[0]["src"],
        "media": media,
        "mediaComplete": True,
        "metalOptions": metals,
        "estWeightG": est_weight,
        "laborUsd": labor,
        "leadDays": lead,
        "availableForSale": True,
        "published": True,
        "supplierEvidence": ref or "CSV style import",
        "firstQuoteAt": "2026-06-27",
        "name": i18n(name, zh),
    }
    data.update(detail_copy(category))
    return data


def local_media(style_id, urls, ref=""):
    media = related_product_media(urls, ref)[:5]
    if media:
        print(f"original media {style_id} {len(media)}")
    return media


def engagement_styles():
    source = list(rows(CSV["engagement"]))[1:]
    named_rows = []
    names = {
        1: "Four-Prong Solitaire Ring",
        2: "Cathedral Six-Prong Solitaire Ring",
        3: "Double-Claw Three-Stone Ring",
        4: "Hidden Halo Side-Stone Ring",
        5: "Toi et Moi Ring",
        6: "Double-Row Side-Stone Halo Ring",
        7: "Bold Bezel Solitaire Ring",
        12: "Six-Prong Solitaire Ring",
        13: "Four-Prong Solitaire Ring",
        14: "Halo Ring",
        15: "Hidden Halo Ring",
        16: "Three-Stone Ring",
        17: "Side-Stone Ring",
        18: "The One Ring",
    }
    for idx, row in enumerate(source, start=1):
        name = names.get(idx)
        if not name:
            continue
        named_rows.append((name, cell(row, 1), cell(row, 11), parse_images(cell(row, 12))))
    styles = []
    for i, (name, zh, ref, urls) in enumerate(named_rows, start=1):
        style_id = f"RING-{i:03d}"
        override = STYLE_MEDIA_OVERRIDES.get(name)
        if override:
            ref = override["ref"]
            zh = override.get("zh", zh)
            urls = override["images"]
        name = product_title_for(ref, urls) or name
        media = local_media(style_id, urls, ref)
        style = base_fields("ring", name, style_id, zh=zh, ref=ref, images=media)
        if style:
            styles.append(style)
    return styles


def band_styles(start):
    styles = []
    for i, row in enumerate(list(rows(CSV["bands"]))[1:], start=start):
        en = clean_name(cell(row, 0))
        if not en:
            continue
        style_id = f"BAND-{i - start + 1:03d}"
        ref = cell(row, 2)
        urls = parse_images(cell(row, 3))
        en = product_title_for(ref, urls) or en
        media = local_media(style_id, urls, ref)
        style = base_fields("ring", en, style_id, zh=cell(row, 1), ref=ref, images=media, fallback_key="band")
        if style:
            styles.append(style)
    return styles


def bracelet_styles():
    styles = []
    for i, row in enumerate(list(rows(CSV["bracelets"]))[1:], start=1):
        en = clean_name(cell(row, 0))
        if not en:
            continue
        style_id = f"BRAC-{i:03d}"
        ref = cell(row, 2)
        urls = parse_images(cell(row, 3))
        en = product_title_for(ref, urls) or en
        media = local_media(style_id, urls, ref)
        style = base_fields("bangle", en, style_id, zh=cell(row, 1), ref=ref, images=media)
        if style:
            styles.append(style)
    return styles


def necklace_styles():
    styles = []
    aliases = {
        "Solitaire": "Solitaire Pendant",
        "Halo": "Halo Pendant",
        "Clover": "Clover Pendant",
        "Graduated": "Graduated Necklace",
        "Journey": "Journey Necklace",
        "Butterfly": "Butterfly Pendant",
        "Cross": "Cross Pendant",
        "Cross 2": "Statement Cross Pendant",
    }
    for row in list(rows(CSV["necklaces"]))[1:]:
        if cell(row, 0) == "Suggested Style(English)":
            continue
        ref = cell(row, 2)
        urls = parse_images(cell(row, 3))
        if not ref and not urls:
            continue
        raw = clean_name(cell(row, 0))
        en = aliases.get(raw, raw)
        if not en:
            continue
        style_id = f"NECK-{len(styles) + 1:03d}"
        en = product_title_for(ref, urls) or en
        media = local_media(style_id, urls, ref)
        style = base_fields("necklace", en, style_id, zh=cell(row, 1), ref=ref, images=media)
        if style:
            styles.append(style)
    return styles


def earring_styles():
    styles = []
    candidates = []
    for row in list(rows(CSV["earrings"]))[1:]:
        stud_name = clean_name(cell(row, 0))
        hoop_name = clean_name(cell(row, 3))
        if stud_name:
            candidates.append((f"{stud_name} Studs" if stud_name in ("Solitaire", "Halo") else f"{stud_name} Earrings", cell(row, 1), cell(row, 5), parse_images(cell(row, 6))))
        if hoop_name:
            candidates.append((hoop_name, cell(row, 4), cell(row, 7), parse_images(cell(row, 8))))
    for i, (name, zh, ref, urls) in enumerate(candidates, start=1):
        style_id = f"EARR-{i:03d}"
        name = product_title_for(ref, urls) or name
        media = local_media(style_id, urls, ref)
        style = base_fields("earrings", name, style_id, zh=zh, ref=ref, images=media)
        if style:
            styles.append(style)
    return styles


def main():
    for path in CSV.values():
        if not path.exists():
            raise SystemExit(f"Missing CSV: {path}")
    styles = []
    styles.extend(engagement_styles())
    styles.extend(band_styles(len(styles) + 1))
    styles.extend(earring_styles())
    styles.extend(bracelet_styles())
    styles.extend(necklace_styles())
    payload = json.dumps(styles, ensure_ascii=False, indent=2)
    OUT.write_text(
        "// Generated by scripts/import_style_csvs.py. Do not edit by hand.\n"
        "export const styleSeedData = "
        + payload
        + ";\n",
        encoding="utf-8",
    )
    print(f"wrote {OUT} with {len(styles)} styles")


if __name__ == "__main__":
    main()
