#!/usr/bin/env python3
"""Monta docs/guia.pdf: la guia para entender y divulgar la app.

Usa las figuras de scripts/guia-figuras.py y los numeros de docs/guia-datos.json
(calculados por el propio motor de la app, scripts/guia-datos.mjs).
"""
import json
import os

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, Frame, Image, KeepTogether, NextPageTemplate,
                                PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIG = os.path.join(ROOT, "docs", "figs")
D = json.load(open(os.path.join(ROOT, "docs", "guia-datos.json")))
PDF = os.path.join(ROOT, "docs", "guia.pdf")

# --- tipografia unicode -----------------------------------------------------
# Las fuentes del sistema no traen la variante oblicua de DejaVu Sans; matplotlib
# sí la incluye, así que se busca en ambos sitios.
import matplotlib

FDIRS = ["/usr/share/fonts/truetype/dejavu",
         os.path.join(matplotlib.get_data_path(), "fonts", "ttf")]


def fuente(nombre, archivo):
    for d in FDIRS:
        ruta = os.path.join(d, archivo)
        if os.path.exists(ruta):
            pdfmetrics.registerFont(TTFont(nombre, ruta))
            return
    raise SystemExit(f"no encuentro la fuente {archivo}")


fuente("DJ", "DejaVuSans.ttf")
fuente("DJ-B", "DejaVuSans-Bold.ttf")
fuente("DJ-I", "DejaVuSans-Oblique.ttf")
fuente("DJ-BI", "DejaVuSans-BoldOblique.ttf")
fuente("DJS", "DejaVuSerif.ttf")
fuente("DJS-B", "DejaVuSerif-Bold.ttf")
fuente("DJM", "DejaVuSansMono.ttf")
pdfmetrics.registerFontFamily("DJ", normal="DJ", bold="DJ-B", italic="DJ-I", boldItalic="DJ-BI")

INK = colors.HexColor("#0b0b0b")
INK2 = colors.HexColor("#3a3936")
MUTED = colors.HexColor("#6f6e68")
S1 = colors.HexColor("#2a78d6")
S2 = colors.HexColor("#eb6834")
S3 = colors.HexColor("#1baf7a")
S4 = colors.HexColor("#4a3aa7")
RULE = colors.HexColor("#dcdbd5")
BOXBG = colors.HexColor("#f4f6f9")
BOXBG2 = colors.HexColor("#fdf3ee")

ss = getSampleStyleSheet()
P = ParagraphStyle("P", parent=ss["BodyText"], fontName="DJ", fontSize=9.2, leading=13.6,
                   alignment=TA_JUSTIFY, textColor=INK2, spaceAfter=5)
PC = ParagraphStyle("PC", parent=P, alignment=TA_CENTER)
H1 = ParagraphStyle("H1", fontName="DJS-B", fontSize=17, leading=21, textColor=INK,
                    spaceBefore=2, spaceAfter=9)
H2 = ParagraphStyle("H2", fontName="DJS-B", fontSize=12.5, leading=16, textColor=INK,
                    spaceBefore=13, spaceAfter=5)
H3 = ParagraphStyle("H3", fontName="DJ-B", fontSize=10, leading=13.5, textColor=S1,
                    spaceBefore=9, spaceAfter=3)
CAP = ParagraphStyle("CAP", parent=P, fontSize=7.8, leading=10.5, textColor=MUTED,
                     alignment=TA_CENTER, spaceBefore=3, spaceAfter=9)
CODE = ParagraphStyle("CODE", fontName="DJM", fontSize=7.8, leading=11, textColor=INK2,
                      backColor=colors.HexColor("#f5f5f2"), borderPadding=5,
                      spaceBefore=4, spaceAfter=7, leftIndent=2)
FORM = ParagraphStyle("FORM", parent=P, alignment=TA_CENTER, fontSize=10.5, leading=16,
                      textColor=INK, spaceBefore=5, spaceAfter=7)
LI = ParagraphStyle("LI", parent=P, leftIndent=11, bulletIndent=2, spaceAfter=2.5)
NOTE = ParagraphStyle("NOTE", parent=P, fontSize=8.6, leading=12.4, textColor=INK2,
                      backColor=BOXBG, borderColor=colors.HexColor("#cfdcee"), borderWidth=0.6,
                      borderPadding=7, spaceBefore=6, spaceAfter=8)
WARN = ParagraphStyle("WARN", parent=NOTE, backColor=BOXBG2,
                      borderColor=colors.HexColor("#f0c3ac"))
TIT = ParagraphStyle("TIT", fontName="DJS-B", fontSize=27, leading=32, textColor=INK,
                     alignment=TA_CENTER)
SUB = ParagraphStyle("SUB", fontName="DJ", fontSize=12.5, leading=18, textColor=MUTED,
                     alignment=TA_CENTER)

SUBS = str.maketrans("0123456789+-", "₀₁₂₃₄₅₆₇₈₉⁺⁻")


def qf(k):
    return "".join(c.translate(SUBS) if (c.isdigit() or c in "+-") else c for c in k)


def h1(t):
    return Paragraph(t, H1)


def h2(t):
    return Paragraph(t, H2)


def h3(t):
    return Paragraph(t, H3)


def p(t):
    return Paragraph(t, P)


def li(t):
    return Paragraph(t, LI, bulletText="•")


def code(t):
    # El texto va dentro de un mini-lenguaje de marcado: hay que escapar & y <>
    # ANTES de meter las etiquetas, o "?a=1&b=2" se convierte en "?a=1&b;=2".
    t = t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return Paragraph(t.replace("\n", "<br/>").replace(" ", "&nbsp;"), CODE)


def form(t):
    return Paragraph(t, FORM)


def nota(t, style=NOTE):
    return Paragraph(t, style)


def figura(nombre, pie, ancho=15.2 * cm):
    path = os.path.join(FIG, nombre)
    from PIL import Image as PILImage
    with PILImage.open(path) as im:
        w, h = im.size
    img = Image(path, width=ancho, height=ancho * h / w)
    return KeepTogether([Spacer(1, 3), img, Paragraph(pie, CAP)])


def tabla(datos, anchos, cabecera=True, size=7.8, align=None):
    # Las cadenas largas se envuelven en Paragraph: reportlab NO parte el texto
    # plano de una celda, se sale de la columna y se solapa con la vecina.
    cuerpo = ParagraphStyle("TD", parent=P, fontSize=size, leading=size * 1.38,
                            alignment=0, spaceAfter=0)
    cab = ParagraphStyle("TH", parent=cuerpo, fontName="DJ-B", textColor=colors.white)
    def celda(x, fila):
        # También las cortas si llevan marcado (<sub>, <b>…): en texto plano
        # reportlab las imprimiría tal cual, con las etiquetas a la vista.
        if isinstance(x, str) and (len(x) > 16 or "<" in x):
            return Paragraph(x, cab if (fila == 0 and cabecera) else cuerpo)
        return x
    datos = [[celda(c, i) for c in fila] for i, fila in enumerate(datos)]
    t = Table(datos, colWidths=anchos, repeatRows=1 if cabecera else 0, hAlign="CENTER")
    est = [
        ("FONT", (0, 0), (-1, -1), "DJ", size),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK2),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("LINEBELOW", (0, 0), (-1, -2), 0.4, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#fafaf8")]),
    ]
    if cabecera:
        est += [("FONT", (0, 0), (-1, 0), "DJ-B", size),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#3f4d5f")),
                ("LINEBELOW", (0, 0), (-1, 0), 0.4, colors.HexColor("#3f4d5f"))]
    if align:
        for col, a in align.items():
            est.append(("ALIGN", (col, 0), (col, -1), a))
    t.setStyle(TableStyle(est))
    return t


# ---------------------------------------------------------------------------
# Plantillas de pagina
# ---------------------------------------------------------------------------
class Guia(BaseDocTemplate):
    def __init__(self, path):
        super().__init__(path, pagesize=A4, leftMargin=2.2 * cm, rightMargin=2.2 * cm,
                         topMargin=2.0 * cm, bottomMargin=1.8 * cm,
                         title="Guía de la app «Modelos cuánticos»",
                         author="Documentación del proyecto", subject="Química cuántica interactiva")
        marco = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="normal")
        self.addPageTemplates([
            PageTemplate(id="portada", frames=[marco]),
            PageTemplate(id="normal", frames=[marco], onPage=self.decorar),
        ])
        self.toc = []

    def decorar(self, canv, doc):
        canv.saveState()
        canv.setFont("DJ", 7.5)
        canv.setFillColor(MUTED)
        canv.drawString(self.leftMargin, A4[1] - 1.35 * cm,
                        "Modelos cuánticos · guía de funcionamiento y divulgación")
        canv.setStrokeColor(RULE)
        canv.setLineWidth(0.5)
        canv.line(self.leftMargin, A4[1] - 1.5 * cm, A4[0] - self.rightMargin, A4[1] - 1.5 * cm)
        canv.drawCentredString(A4[0] / 2, 1.1 * cm, str(canv.getPageNumber()))
        canv.restoreState()


# ---------------------------------------------------------------------------
# Contenido
# ---------------------------------------------------------------------------
E = []


def parte(num, titulo, bajada):
    E.append(PageBreak())
    E.append(Spacer(1, 3.2 * cm))
    E.append(Paragraph(f"Parte {num}", ParagraphStyle(
        "PN", fontName="DJ", fontSize=11, textColor=S1, alignment=TA_CENTER, spaceAfter=6)))
    E.append(Paragraph(titulo, ParagraphStyle(
        "PT", fontName="DJS-B", fontSize=22, leading=27, textColor=INK, alignment=TA_CENTER)))
    E.append(Spacer(1, 0.5 * cm))
    E.append(Paragraph(bajada, ParagraphStyle(
        "PB", parent=P, alignment=TA_CENTER, textColor=MUTED, fontSize=10, leading=15)))


def controles(filas, ancho=(4.3, 5.4, 6.0)):
    """Tabla de controles: nombre exacto en la app · qué hace · para qué sirve."""
    datos = [["Control (tal cual en la app)", "Qué hace", "Para qué sirve"]]
    for a, b, c in filas:
        datos.append([Paragraph(f"<b>{a}</b>", ParagraphStyle(
            "CN", parent=P, fontSize=7.6, leading=10.4, spaceAfter=0)),
            Paragraph(b, ParagraphStyle("CD", parent=P, fontSize=7.6, leading=10.4, spaceAfter=0)),
            Paragraph(c, ParagraphStyle("CP", parent=P, fontSize=7.6, leading=10.4, spaceAfter=0))])
    E.append(tabla(datos, [ancho[0] * cm, ancho[1] * cm, ancho[2] * cm], size=7.6))


# ===========================================================================
def portada():
    # OJO: todo esto tiene que caber en UNA página. Si se pasa, el título se
    # queda solo en la primera y las figuras se van a una segunda que parece
    # vacía. Con dos figuras no cabía: se deja solo la del agua (la de la
    # leyenda ya abre el capítulo 2).
    E.append(Spacer(1, 4.4 * cm))
    E.append(Paragraph("Modelos cuánticos en 3D y realidad virtual", TIT))
    E.append(Spacer(1, 0.5 * cm))
    E.append(Paragraph("Guía de uso y de la física que hay detrás:<br/>"
                       "qué hace cada control y qué estás viendo en pantalla", SUB))
    E.append(Spacer(1, 1.3 * cm))
    E.append(figura("fig-mapa-h2o.png", "", ancho=9.6 * cm))
    E.append(Spacer(1, 0.8 * cm))
    E.append(Paragraph(
        "Todos los números y figuras de este documento los ha calculado el propio motor "
        "de la aplicación", SUB))
    E.append(NextPageTemplate("normal"))
    E.append(PageBreak())


def indice():
    E.append(h1("Qué contiene esta guía"))
    E.append(p(
        "La aplicación hace dos cosas que normalmente van por separado: <b>resuelve</b> problemas de "
        "química cuántica —desde el átomo de hidrógeno hasta la estructura electrónica de moléculas "
        "por el método de Hartree-Fock— y los <b>enseña</b>, dibujándolos en tres dimensiones y "
        "dejándote entrar dentro de ellos con unas gafas de realidad virtual."))
    E.append(p(
        "La guía está pensada para leerse en ese orden: primero <b>manejar</b> el programa (qué hace "
        "cada botón y cómo interpretar lo que aparece), después la <b>física</b> de cada modelo, y al "
        "final el material de <b>referencia</b>."))
    filas = [
        ["I", "1 · Puesta en marcha", "Arrancar en el PC y en las gafas"],
        ["", "2 · Cómo leer lo que ves", "Los colores, las cuatro representaciones, los marcadores"],
        ["", "3 · Los controles, modelo a modelo", "Cada casilla y cada deslizador, para qué sirve"],
        ["", "4 · Recetas", "Qué tocar para conseguir cada imagen"],
        ["II", "5 · Átomo de hidrógeno", "La solución exacta"],
        ["", "6 · Orbitales híbridos", "sp, sp², sp³"],
        ["", "7 · Partícula en una caja", "De dónde sale la cuantización"],
        ["", "8 · Estructura fina", "Espín-órbita"],
        ["", "9 · Átomo polielectrónico", "Hartree-Fock paso a paso, Slater, SCF"],
        ["", "10 · Moléculas", "Orbitales moleculares, curva E(R), cargas"],
        ["", "11 · QTAIM", "Átomos, enlaces y cuencas a partir de ρ(r)"],
        ["III", "12 · Notación", "Qué significa cada símbolo"],
        ["", "13 · Validación y límites", "Contraste con valores publicados"],
        ["", "14 · Guion de divulgación", "Nueve demostraciones listas"],
        ["", "15 · Glosario y referencias", "Vocabulario mínimo"],
    ]
    E.append(Spacer(1, 4))
    E.append(tabla([["Parte", "Capítulo", "De un vistazo"]] + filas,
                   [1.3 * cm, 6.4 * cm, 8.0 * cm], size=8.2))
    E.append(nota(
        "<b>Si solo quieres usar la aplicación</b>, con los capítulos 2 y 3 tienes bastante. "
        "<b>Si vas a explicarla a otras personas</b>, añade el 14. <b>Si quieres saber qué hace por "
        "dentro</b>, la parte II lo cuenta sin dar por sabido nada más allá de un primer curso de "
        "química general."))


# ===========================================================================
# PARTE I
# ===========================================================================
def cap1():
    parte("I", "Manejar la aplicación", "Arrancarla, entender la imagen y saber qué hace cada control.")
    E.append(PageBreak())
    E.append(h1("1 · Puesta en marcha"))
    E.append(p(
        "Es una página web —no hay que instalar nada— construida con <b>Three.js</b> (gráficos 3D), "
        "<b>WebXR</b> (realidad virtual en el navegador) y <b>Vite</b>. Todo el cálculo está escrito "
        "desde cero en JavaScript, sin bibliotecas de química cuántica: cada número que ves en "
        "pantalla se puede rastrear hasta una línea de código legible."))
    E.append(h2("En el computador"))
    E.append(code("npm install\nnpm run dev        →  abre http://localhost:5174/"))
    E.append(nota(
        "<b>El tropiezo más habitual.</b> Hacer doble clic en <font face='DJM' size='8'>index.html</font> "
        "abre la página pero deja la escena <b>en blanco</b>: el navegador no sabe resolver por su "
        "cuenta ni la ruta <font face='DJM' size='8'>/src/main.js</font> ni el módulo "
        "<font face='DJM' size='8'>three</font>. Hace falta el servidor. Si prefieres el archivo "
        "compilado: <font face='DJM' size='8'>npm run build && npm run preview</font>.", WARN))
    E.append(h2("En las gafas Meta Quest"))
    E.append(p(
        "Para que aparezca el botón <b>ENTER VR</b> la página debe llegar por un <i>contexto seguro</i>. "
        "Hay dos caminos que lo cumplen:"))
    E.append(tabla([["Camino", "URL en las gafas", "Cuándo usarlo"],
                    ["Cable USB (adb reverse)", "http://localhost:5174/", "desarrollo: no depende de la red"],
                    ["Despliegue en Netlify", "https://quimcuant.netlify.app/", "aula o público, por wifi"]],
                   [4.6 * cm, 5.6 * cm, 5.6 * cm]))
    E.append(p(
        "Abrir <font face='DJM' size='8'>http://192.168.x.x:5174/</font> por wifi carga la página pero "
        "<b>no da VR</b>: una dirección IP por HTTP no es contexto seguro."))
    E.append(h2("Los seis modelos"))
    E.append(tabla([["Modelo", "Naturaleza", "Qué se obtiene"],
                    ["Átomo de hidrógeno", "exacto", "ψ(r,θ,φ) analítica; orbitales 1s…4f; ⟨r⟩, Δr, nodos"],
                    ["Orbitales híbridos", "exacto", "sp, sp², sp³ como combinaciones de 2s y 2p"],
                    ["Estructura fina", "perturbativa", "espín-órbita, estados |n,ℓ,j,m<sub>j</sub>⟩"],
                    ["Partícula en una caja", "exacto", "1D, 2D y 3D; niveles y degeneraciones"],
                    ["Átomo polielectrónico", "Hartree-Fock", "H…Ar y sus iones; determinante de Slater"],
                    ["Molécula", "Hartree-Fock", "≈28 moléculas; orbitales, densidad, QTAIM"]],
                   [4.0 * cm, 2.6 * cm, 9.2 * cm]))


def cap2():
    E.append(PageBreak())
    E.append(h1("2 · Cómo leer lo que ves"))
    E.append(p(
        "Esta es la sección que conviene leer antes que ninguna otra. La aplicación dibuja funciones "
        "de tres variables, y para eso usa unos pocos convenios de color y de forma que, una vez "
        "aprendidos, valen para todos los modelos."))

    E.append(h2("2.1 · Los colores"))
    E.append(p(
        "Hay <b>dos usos distintos del color</b>, y confundirlos es la fuente número uno de "
        "malentendidos:"))
    E.append(li("<b>Color por signo</b> — rojo y azul. Se usa cuando lo dibujado puede ser positivo o "
                "negativo: la función de onda ψ, un orbital molecular, el laplaciano, la densidad de "
                "espín. <font color='#c0392b'><b>Rojo = valor positivo</b></font>; "
                "<font color='#2a78d6'><b>azul = valor negativo</b></font>. Los dos colores son "
                "igual de «reales»: el signo de ψ no se mide, pero decide si dos orbitales se suman "
                "(enlace) o se cancelan (antienlace)."))
    E.append(li("<b>Color por magnitud</b> — una rampa de claro a oscuro. Se usa cuando lo dibujado "
                "es siempre positivo: |ψ|², la densidad electrónica ρ, la ELF. Aquí no hay signo que "
                "mostrar; el color mide <i>cuánto</i>."))
    E.append(figura("fig-leyenda.png",
                    "Figura 1. El mismo orbital 2p del hidrógeno, en el mismo plano, visto de las "
                    "cuatro maneras que ofrece la aplicación. Los colores son exactamente los del "
                    "programa."))
    E.append(nota(
        "<b>Por eso los dos lóbulos de un orbital p salen rojo y azul.</b> No son «dos cosas»: "
        "son las dos mitades de la misma función de onda, separadas por un plano donde ψ vale cero. "
        "Si cambias a <b>Densidad |ψ|²</b> los dos lóbulos se vuelven del mismo color: al elevar al "
        "cuadrado, el signo desaparece."))
    E.append(h3("Y cuando lo dibujado no es ψ"))
    E.append(p(
        "En los modelos de átomo y molécula el desplegable <b>Qué se dibuja</b> permite representar "
        "otras magnitudes. El convenio de color sigue la misma regla:"))
    E.append(tabla([["Qué se dibuja", "signo", "color", "Qué significa el color"],
                    ["Orbital (ψ)", "sí", "rojo / azul", "las dos fases del orbital"],
                    ["Densidad electrónica ρ", "no", "verde (isosup.)", "dónde hay electrones"],
                    ["Laplaciano −∇²ρ", "sí", "rojo / azul",
                     "rojo: carga concentrada (enlace, pares); azul: carga replegada"],
                    ["ELF (localización)", "no", "morado (isosup.)", "regiones con un par de electrones"],
                    ["Densidad de espín", "sí", "rojo / azul", "exceso de espín α (rojo) o β (azul)"]],
                   [3.6 * cm, 1.5 * cm, 2.6 * cm, 8.5 * cm]))

    E.append(h2("2.2 · Las cuatro maneras de dibujar lo mismo"))
    E.append(p(
        "Los cuatro paneles de la figura 1 no son cuatro cosas distintas: son <b>los mismos números</b> "
        "presentados de cuatro formas, y cada una se ve mejor para una pregunta distinta."))
    E.append(tabla([["Representación", "Qué dibuja exactamente", "Para qué es buena", "Su trampa"],
                    ["Isosuperficie", "la superficie donde la función vale un valor fijo",
                     "ver la forma y la simetría", "parece un objeto sólido con frontera, y no lo es"],
                    ["Nube de puntos", "puntos sorteados con probabilidad ∝ |ψ|²",
                     "entender qué es una distribución de probabilidad", "es ruidosa; pocos puntos engañan"],
                    ["Cortes (planos)", "el valor sobre un plano, en color",
                     "leer el interior, que la isosuperficie tapa", "solo ves ese plano"],
                    ["Sonda", "el número exacto en un punto",
                     "pasar de la imagen al dato", "un punto no cuenta la historia entera"]],
                   [2.7 * cm, 4.6 * cm, 4.0 * cm, 4.9 * cm]))
    E.append(nota(
        "<b>Consejo.</b> Empieza siempre por la nube y termina por la isosuperficie, no al revés. "
        "La nube transmite lo que un orbital <i>es</i>; la isosuperficie se entiende después como lo "
        "que realmente es: una curva de nivel, como las de un mapa topográfico."))

    E.append(h2("2.3 · Los marcadores de QTAIM"))
    E.append(p(
        "Al activar <b>Puntos críticos + caminos</b> aparecen unas esferas de colores. Son los puntos "
        "donde el gradiente de la densidad se anula, y cada color es un tipo distinto:"))
    E.append(figura("fig-marcadores.png",
                    "Figura 2. Los marcadores que dibuja la aplicación, con su significado.",
                    ancho=15.0 * cm))
    E.append(nota(
        "<b>Un detalle que confunde a todo el mundo.</b> Los puntos críticos <i>nucleares</i> son "
        "<b>máximos</b> de la densidad, pero normalmente no se dibujan como esfera de color: ya están "
        "representados por la esfera del átomo. Si desmarcas <b>Núcleos</b>, la aplicación los marca "
        "con una esferita blanca — de lo contrario verías solo los puntos de <b>silla</b> (los de "
        "enlace) y parecería que faltan los máximos que el panel sí cuenta en la relación "
        "n − b + r − c = 1."))

    E.append(h2("2.4 · El panel de la izquierda, bloque a bloque"))
    E.append(p("El texto que aparece a la izquierda no es decorativo: es el resultado del cálculo."))
    E.append(tabla([["Bloque", "Qué te está diciendo"],
                    ["Cabecera (sistema, base, método)",
                     "qué se ha resuelto: núcleos, electrones, multiplicidad, tamaño de la base y si el "
                     "SCF convergió y en cuántas iteraciones"],
                    ["Energía",
                     "energía total y su desglose: electrónica, repulsión nuclear, cinética ⟨T⟩ y "
                     "potenciales. El cociente −V/T debería valer 2 (teorema del virial): es una "
                     "comprobación de que el cálculo está sano"],
                    ["Determinante de Slater",
                     "la función de onda concreta, con sus espín-orbitales ocupados"],
                    ["Orbitales atómicos / moleculares",
                     "energía, ocupación y composición de <b>todos</b> los orbitales ocupados más "
                     "unos cuantos vacíos, con el HOMO y el LUMO marcados. En capa abierta hay "
                     "columnas separadas para α (↑) y β (↓), porque en UHF cada espín tiene sus "
                     "propios orbitales y sus propias energías: así el recuento de electrones cuadra "
                     "a simple vista"],
                    ["Cargas atómicas",
                     "Mulliken siempre; Bader cuando lo calculas con su botón"],
                    ["QTAIM · topología",
                     "cuántos puntos críticos de cada tipo, la comprobación de Poincaré-Hopf y una "
                     "tabla con ρ, ∇²ρ y la clasificación de cada enlace"],
                    ["Sonda", "los valores del campo en el punto donde la has puesto"]],
                   [4.4 * cm, 11.4 * cm]))


def cap3():
    E.append(PageBreak())
    E.append(h1("3 · Los controles, modelo a modelo"))
    E.append(p(
        "El panel <b>Controles</b> se reorganiza solo: cada modelo muestra las carpetas que le "
        "aplican y esconde las demás. Aquí van todas, con el nombre exacto que verás en pantalla."))

    E.append(h2("3.1 · Selector de modelo"))
    controles([
        ("Modelo", "Elige qué sistema se resuelve: hidrógeno, híbridos, átomo polielectrónico, "
                   "molécula o caja 1D/2D/3D.",
         "Es el control maestro: cambia por completo el resto del panel y lo que se dibuja."),
    ])

    E.append(h2("3.2 · Átomo de hidrógeno"))
    controles([
        ("Especie (átomo)", "Cambia el núcleo: ¹H, ²H, ³H, He⁺, Li²⁺, Be³⁺.",
         "Ver cómo se contrae el orbital al subir la carga nuclear, y el efecto (pequeñísimo) de la "
         "masa del núcleo entre isótopos."),
        ("Orbital", "Selecciona n, ℓ, m: de 1s hasta 4f.",
         "Es el catálogo de formas. Contar nodos: n − ℓ − 1 radiales y ℓ angulares."),
        ("Mostrar espín · Espín mₛ", "Dibuja una flecha con la proyección del espín.",
         "Recordar que el orbital solo describe la parte espacial: el electrón lleva además su espín."),
        ("Estructura fina (j)", "Pasa a los estados |n, ℓ, j, m<sub>j</sub>⟩ del acoplamiento espín-órbita.",
         "Ver que al incluir el espín los estados ya no se separan en «forma × espín»."),
        ("j = ℓ + ½ · mⱼ × 2", "Eligen dentro del multiplete de estructura fina.",
         "Comparar las dos ramas j = ℓ ± ½ y sus densidades angulares."),
    ])
    E.append(h3("Sonda (r, θ, φ) — solo en hidrógeno"))
    controles([
        ("Activar sonda", "Muestra un marcador móvil y su lectura numérica.",
         "Pasar de la imagen al número: ψ y |ψ|² en un punto concreto."),
        ("Animar sonda · Variable animada", "Recorre θ, φ o ambos automáticamente.",
         "Ver cómo cambia ψ al girar alrededor del núcleo: así se «oye» la parte angular."),
        ("r · θ · φ", "Posición de la sonda en coordenadas esféricas.",
         "Situarla justo en un nodo y comprobar que ψ vale cero allí."),
    ])
    E.append(h3("Comparar"))
    controles([
        ("Activar comparación · Orbital B", "Dibuja un segundo orbital junto al primero.",
         "Comparar tamaños y formas: 2s frente a 3s, 2p frente a 3d."),
    ])

    E.append(h2("3.3 · Orbitales híbridos"))
    controles([
        ("Hibridación", "sp, sp² o sp³.",
         "Ver la geometría que cada una impone: lineal, trigonal plana, tetraédrica."),
        ("Mostrar", "Conjunto completo o un lóbulo individual.",
         "El conjunto enseña la geometría; el lóbulo suelto enseña de qué está hecho cada híbrido."),
        ("Lóbulo (individual)", "Cuál de los híbridos se dibuja.",
         "Recorrerlos y comprobar que son idénticos salvo por su orientación."),
    ])

    E.append(h2("3.4 · Partícula en una caja"))
    controles([
        ("n_x, n_y, n_z", "Números cuánticos por eje (1 a 6).",
         "Contar semiondas: n − 1 nodos por eje. La energía va como la suma de (n/L)²."),
        ("L_x, L_y, L_z", "Dimensiones de la caja.",
         "Al hacerla cúbica, estados distintos coinciden en energía: eso es una degeneración. "
         "Al estirar un eje, la degeneración se rompe."),
    ])

    E.append(h2("3.5 · Átomo polielectrónico"))
    controles([
        ("Elemento", "Cualquier átomo de H a Ca (Z ≤ 20).",
         "Recorrer un periodo y ver cómo se contraen los orbitales al aumentar Z."),
        ("Carga", "De −2 a +3: aniones y cationes.",
         "Ver el efecto de quitar o añadir electrones. Los aniones necesitan base con difusas."),
        ("Multiplicidad de Hund", "Si está marcada, la multiplicidad la fija la regla de Hund.",
         "Desmarcarla permite forzar otro estado de espín y comprobar que su energía es mayor."),
        ("Multiplicidad", "El valor 2S + 1 cuando lo fijas a mano.",
         "Comparar singlete y triplete del mismo sistema."),
    ])

    E.append(h2("3.6 · Molécula (OM)"))
    controles([
        ("Molécula", "Catálogo de ≈28 moléculas con geometría experimental.",
         "De H₂ al benceno, pasando por iones y radicales."),
        ("Distancia de enlace (×)", "Multiplica la distancia de equilibrio (solo diatómicas).",
         "Estirar y comprimir el enlace y ver cómo responden la energía y los orbitales."),
        ("Curva E(R)", "Calcula la curva de energía potencial completa (10 a 20 puntos, según lo "
                       "que cueste cada SCF).",
         "Obtener distancia de equilibrio y energía de disociación. Ojo: son muchos SCF seguidos y "
         "el hilo de cálculo no atiende nada más mientras tanto — la escena se queda quieta hasta "
         "que termina. El panel muestra el tiempo estimado."),
    ])

    E.append(h2("3.7 · Base (común a átomo y molécula)"))
    E.append(p(
        "Esta carpeta es la que decide la <b>calidad</b> del cálculo. Es también donde se puede tocar "
        "el teorema variacional en directo."))
    controles([
        ("Tipo de función", "Slater (STO-nG), hidrogenoide o gaussianas even-tempered.",
         "Comparar tres maneras de construir la base y ver cuál baja más la energía."),
        ("Gaussianas por función", "Cuántas gaussianas imitan cada función (1 a 6).",
         "Subirlo mejora sobre todo la zona del núcleo. Con 3 o menos, algunos hidrógenos pierden "
         "hasta su punto crítico de enlace (ver §11)."),
        ("Calidad", "Mínima, doble ζ, con difusas y/o con polarización.",
         "Mínima para explorar rápido; doble ζ para resultados; difusas obligatorias en aniones."),
        ("Escala de ζ (variacional)", "Multiplica todos los exponentes a la vez.",
         "Moverlo a mano y mirar la energía: es el teorema variacional en tus dedos."),
        ("Optimizar ζ (variacional)", "Barre ese factor y se queda con el mínimo.",
         "En el helio da ζ = 1,6875, el 27/16 de los libros."),
        ("Optimizar ζ por subcapa", "Optimiza un factor independiente para 1s, 2s, 2p…",
         "Ver que las capas internas y las de valencia quieren exponentes muy distintos."),
    ])

    E.append(h2("3.8 · Qué se dibuja"))
    controles([
        ("Qué se dibuja", "Orbital (ψ), densidad ρ, laplaciano −∇²ρ, ELF o densidad de espín.",
         "Cada campo cuenta una historia distinta del mismo sistema (§2.1)."),
        ("Orbital molecular / Orbital atómico",
         "Cuál de los orbitales se representa; se numeran desde 1, igual que en la tabla del panel "
         "izquierdo. En un átomo el control se llama <i>atómico</i> y en una molécula, <i>molecular</i>.",
         "Recorrerlos de menor a mayor energía es ver cómo se construye la capa o el enlace."),
        ("◀ anterior · siguiente ▶", "Avanzan de uno en uno.",
         "Mucho más cómodo que el deslizador cuando hay treinta orbitales."),
        ("Ir al HOMO · Ir al LUMO", "Saltan a los dos orbitales frontera.",
         "Son los que gobiernan la reactividad: el par que se cede y el hueco que se ocupa."),
        ("Espín", "α o β (solo en cálculos de capa abierta).",
         "Ver que en un radical los orbitales α y β no son iguales."),
        ("Nivel iso (u.a.)", "El valor al que se corta el campo.",
         "Bajarlo agranda la superficie. Ojo: significa algo distinto en cada campo (tabla siguiente)."),
        ("Núcleos · Enlaces", "Dibujan las esferas atómicas y las barras.",
         "Quitarlos deja ver el campo sin estorbos; al quitar los núcleos aparecen sus puntos críticos."),
    ])
    E.append(h3("Qué significa exactamente «Nivel iso» en cada campo"))
    E.append(tabla([["Campo", "Nivel dibujado", "Valor típico"],
                    ["Orbital (ψ)", "«Nivel iso» × el máximo del campo (fracción)", "0,10 – 0,20"],
                    ["Densidad ρ", "el valor directo, en e/bohr³", "0,001 (tamaño molecular); 0,05"],
                    ["Laplaciano −∇²ρ", "«Nivel iso (u.a.)» × 20", "0,05 – 0,20"],
                    ["ELF", "0,4 + «Nivel iso» (tope 0,97)", "0,4 → ELF = 0,8, el valor clásico"],
                    ["Densidad de espín", "«Nivel iso (u.a.)» ÷ 10", "0,01 – 0,05"]],
                   [3.6 * cm, 8.0 * cm, 4.6 * cm]))

    E.append(h2("3.9 · QTAIM (átomos en moléculas)"))
    controles([
        ("Puntos críticos + caminos", "Lanza el análisis topológico de ρ y dibuja el resultado.",
         "Ver dónde hay enlace de verdad según la densidad, no según nuestras barras."),
        ("Etiquetas de los BCP", "Rótulos flotantes con el par de átomos y el valor de ρ.",
         "Leer la «fuerza» de cada enlace sin salir de la escena."),
        ("Resolución de cuencas", "Malla para integrar: 48 (rápido) a 96 (fino).",
         "48 para tantear; 80–96 cuando el número importe."),
        ("Calcular cargas de Bader", "Integra la densidad dentro de cada cuenca atómica.",
         "La partición de carga que no depende de la base. Tarda unos segundos."),
        ("Ver cuencas atómicas", "Pinta la nube de densidad con el color de cada átomo. Si aún no "
                                 "están calculadas las calcula, y las rehace sola al cambiar de "
                                 "sistema o de base.",
         "Ver literalmente dónde acaba un átomo y empieza el siguiente."),
        ("Campo vectorial ∇ρ", "Dibuja flechas del gradiente de la densidad electrónica.",
         "Ver la construcción que hay detrás de todo QTAIM: siguiendo las flechas siempre se llega "
         "a un núcleo, y la frontera entre haces de flechas es la superficie que separa dos átomos."),
        ("Campo ∇ρ: dónde", "<i>Sobre los planos</i> dibuja la proyección del gradiente en los planos "
                            "de corte activos (el XZ si no hay ninguno); <i>en volumen</i> reparte "
                            "flechas por una rejilla 3D con el vector completo.",
         "El plano es el mapa clásico de los libros y se lee mucho mejor; el volumen enseña que el "
         "campo llena el espacio, aunque con muchas flechas se tapan entre sí."),
    ])

    E.append(h2("3.10 · Visualización (común a todos los modelos 3D)"))
    controles([
        ("Isosuperficie · Nivel iso", "Activa la superficie de nivel y elige su valor.",
         "La forma «de libro» del orbital."),
        ("Iso en degradado (varias capas)",
         "En vez de una sola superficie dibuja cuatro anidadas, con el color y la transparencia "
         "graduados y los niveles en progresión geométrica.",
         "Una isosuperficie sola convierte un campo continuo en una dicotomía dentro/fuera; con "
         "varias capas se recupera la sensación de gradiente sin perder la forma. Imprescindible en "
         "el laplaciano, que abarca varios órdenes de magnitud."),
        ("Densidad |ψ|²", "Dibuja |ψ|² en vez de ψ.",
         "Comparar los dos: al elevar al cuadrado desaparecen el signo y los colores."),
        ("Superficies nodales", "Marca dónde la función vale cero.",
         "Los nodos son la firma de cada orbital; verlos explica la regla de conteo."),
        ("Nube de puntos · Forma · Color · Nº de puntos",
         "Nube por muestreo; puntos o hilos; color por signo, en <i>degradado continuo</i> o violeta; "
         "cuántos.",
         "Más puntos = imagen más fiel pero más lenta. En VR se limita sola para no perder fluidez."),
        ("Cortes (planos) · Plano XY / XZ / YZ", "Mapas de color del campo sobre planos.",
         "Es la manera de ver el interior. Equivale a los mapas 2D de esta guía."),
        ("Opacidad", "Transparencia de las superficies.",
         "Bajarla para ver capas internas o los núcleos por dentro."),
        ("Resolución malla", "Puntos por eje de la rejilla de muestreo (24 a 96).",
         "Sube el detalle de la isosuperficie; es el control que más cuesta en tiempo."),
    ])
    E.append(nota(
        "Cambiar cualquiera de estos controles en un átomo o una molécula <b>no repite el cálculo</b>: "
        "la función de onda ya está resuelta y solo se vuelve a dibujar. La única excepción es "
        "<b>Resolución malla</b>, que obliga a volver a muestrear el campo (rápido, pero no instantáneo)."))

    E.append(h2("3.11 · Unidades y utilidades"))
    controles([
        ("Longitud · Energía", "a₀, ångström o picómetro; eV o hartree.",
         "Hablar en las unidades de tu audiencia sin recalcular nada."),
        ("Captura PNG", "Guarda la vista actual.",
         "Material para diapositivas o informes."),
        ("Reiniciar vista", "Devuelve la cámara a su posición inicial.",
         "El botón de pánico cuando te has perdido dentro de la nube."),
    ])

    E.append(h2("3.12 · Dentro de las gafas"))
    E.append(p(
        "El panel HTML no existe en modo inmersivo, así que al entrar aparece un <b>menú flotante</b> "
        "con los controles esenciales; se apunta con el rayo del mando y se pulsa con el gatillo. "
        "Lleva las mismas capas que el panel de escritorio (isosuperficie, nube, cortes, sonda, nivel "
        "iso, tamaño, recentrar, forma y color de la nube) y, en átomo y molécula, los botones "
        "<b>HOMO</b> y <b>LUMO</b>. Los rótulos cambian con el modelo: en un átomo dice «orbital "
        "atómico» y «elemento»; en una molécula, «orbital molecular» y «molécula»."))
    E.append(tabla([["Mando", "Qué hace"],
                    ["Botón A/X o B/Y", "muestra u oculta el menú"],
                    ["Joystick izquierda / derecha", "orbital anterior / siguiente"],
                    ["Joystick arriba / abajo", "cambia de molécula o de elemento"],
                    ["Gatillo (fuera del menú)", "mueve la sonda al punto que señalas"],
                    ["Grip con un mando", "agarrar, rotar y mover el sistema"],
                    ["Grip con los dos", "escalar (acercar o alejar la nube)"],
                    ["Botón de recentrar", "vuelve a colocar el sistema delante de ti"]],
                   [5.2 * cm, 10.6 * cm]))


def cap4():
    E.append(PageBreak())
    E.append(h1("4 · Recetas"))
    E.append(p("Qué tocar, exactamente, para conseguir cada imagen."))
    recetas = [
        ("Ver los nodos de un orbital",
         "Hidrógeno → Orbital 3s → <b>Isosuperficie</b> ON, <b>Superficies nodales</b> ON, "
         "<b>Opacidad</b> ≈ 0,5.",
         "Las dos esferas nodales quedan a la vista dentro de la superficie exterior."),
        ("Convencer de que |ψ|² no tiene signo",
         "Con un 2p a la vista, marca <b>Densidad |ψ|²</b>.",
         "Los lóbulos rojo y azul pasan a ser del mismo color."),
        ("Los mapas de laplaciano y ELF de esta guía, pero en 3D",
         "Molécula H₂O → <b>Qué se dibuja</b> = ELF → <b>Cortes (planos)</b> ON y <b>Plano XZ</b> ON. "
         "Para la versión en volumen: <b>Isosuperficie</b> ON con <b>Nivel iso</b> = 0,4 (ELF = 0,8).",
         "El corte reproduce el mapa 2D dentro de la escena; la isosuperficie muestra los cuatro "
         "«globos» de pares electrónicos que se pueden rodear y mirar desde cualquier ángulo."),
        ("Comparar un enlace covalente con uno iónico",
         "Molécula N₂, <b>Qué se dibuja</b> = Laplaciano −∇²ρ, <b>QTAIM</b> ON. Repite con LiF.",
         "En el N₂ hay concentración de carga entre los núcleos; en el LiF, no."),
        ("Recorrer los orbitales moleculares en orden",
         "<b>Qué se dibuja</b> = Orbital, y luego <b>Ir al HOMO</b> y <b>◀ ▶</b>.",
         "Ir del más profundo al más alto es ver cómo se arma el enlace capa por capa."),
        ("Medir cuánta carga se transfiere",
         "Molécula CO → <b>Calcular cargas de Bader</b> (resolución 80).",
         "Compara con las de Mulliken del mismo panel: la diferencia es espectacular."),
        ("Ver dónde acaba un átomo",
         "Tras calcular Bader, marca <b>Ver cuencas atómicas</b>.",
         "La nube se colorea por átomo: esa frontera es la superficie de flujo cero."),
        ("Sacar el 27/16 del helio",
         "Modelo Átomo, Elemento He, base Slater mínima → <b>⚡ Optimizar ζ</b>.",
         "La curva E(ζ) aparece abajo con su mínimo marcado."),
    ]
    for t, ajustes, resultado in recetas:
        E.append(h3(t))
        E.append(Paragraph(ajustes, ParagraphStyle("RA", parent=P, fontSize=8.6, textColor=INK2,
                                                   spaceAfter=2)))
        E.append(Paragraph(f"<i>{resultado}</i>", ParagraphStyle("RR", parent=P, fontSize=8.4,
                                                                 textColor=MUTED, spaceAfter=6)))


# ===========================================================================
# PARTE II
# ===========================================================================
def cap5():
    parte("II", "La física, modelo a modelo",
          "Qué resuelve cada modelo, con qué aproximaciones y qué mirar en pantalla.")
    E.append(PageBreak())
    E.append(h1("5 · Átomo de hidrógeno"))
    E.append(p(
        "Es uno de los dos problemas de la química cuántica que se resuelven con papel y lápiz. En la "
        "aplicación no se «calcula»: se <b>evalúa</b> la fórmula exacta. Por eso sirve de patrón de "
        "medida para todo lo demás."))
    E.append(form("ψ<sub>nℓm</sub>(r, θ, φ) = R<sub>nℓ</sub>(r) · Y<sub>ℓm</sub>(θ, φ)"))
    E.append(p(
        "La parte radial R<sub>nℓ</sub> se construye con los <b>polinomios asociados de Laguerre</b>; "
        "los armónicos esféricos se toman en su forma <b>real</b> (p<sub>x</sub>, p<sub>y</sub>, "
        "p<sub>z</sub>…), que es la que dibujan los libros de química. El signo de ψ se representa "
        "con los dos colores del capítulo 2, así que ver dónde cambia de color es ver los "
        "<b>nodos</b>: n − ℓ − 1 radiales y ℓ angulares."))
    E.append(figura("fig-hidrogeno.png",
                    "Figura 3. Izquierda: la parte radial, donde se cuentan los nodos (2s corta una "
                    "vez el eje; 3s, dos). Derecha: la distribución radial r²|R|², cuyo máximo es el "
                    "radio más probable — para el 1s, exactamente un radio de Bohr."))
    E.append(p(
        "El panel muestra en vivo ⟨r⟩, Δr y ⟨1/r⟩, y la sonda permite leer ψ y |ψ|² en un punto. "
        "Es la manera más directa de comprobar que la densidad es máxima <i>en</i> el núcleo mientras "
        "que la distribución radial tiene su máximo <i>lejos</i> de él: la diferencia está en el "
        "factor r² del volumen disponible."))


def cap6():
    E.append(PageBreak())
    E.append(h1("6 · Orbitales híbridos"))
    E.append(p(
        "Un híbrido es una combinación lineal del 2s con los 2p del mismo átomo. La aplicación los "
        "construye con los coeficientes exactos, de modo que se ve cómo la mezcla concentra densidad "
        "en un lóbulo y la cancela en el opuesto:"))
    E.append(form("sp³ :  ψ = ½ (2s + 2p<sub>x</sub> + 2p<sub>y</sub> + 2p<sub>z</sub>)"))
    E.append(p(
        "Es la mejor demostración de que la hibridación <b>no es física nueva</b>, sino un cambio de "
        "base: la densidad total de los cuatro híbridos es idéntica a la de 2s + 2p<sub>x</sub> + "
        "2p<sub>y</sub> + 2p<sub>z</sub>. Lo que cambia es qué combinación resulta cómoda para hablar "
        "de enlaces dirigidos."))


def cap7():
    E.append(PageBreak())
    E.append(h1("7 · Partícula en una caja"))
    E.append(p(
        "Con paredes infinitas, ψ es un producto de senos y la energía es una suma de términos "
        "enteros. Es el modelo más barato que produce los tres fenómenos centrales:"))
    E.append(li("<b>Cuantización</b>: solo caben números enteros de semiondas, así que solo hay "
                "ciertas energías. No se postula: sale de la condición de que ψ se anule en las paredes."))
    E.append(li("<b>Energía de punto cero</b>: ni siquiera el estado más bajo tiene energía nula. "
                "Confinar cuesta energía."))
    E.append(li("<b>Degeneración</b>: al hacer la caja cúbica, estados distintos coinciden en "
                "energía; al estirar un eje, la coincidencia se rompe. La simetría es la causa."))
    E.append(h2("8 · Estructura fina"))
    E.append(p(
        "Sobre el hidrógeno se añade la corrección relativista de primer orden: el acoplamiento "
        "<b>espín-órbita</b> desdobla cada nivel según j = ℓ ± ½. La aplicación dibuja la densidad "
        "angular de los estados |n, ℓ, j, m<sub>j</sub>⟩, que ya no se separan en «forma × espín», y "
        "muestra el desdoblamiento, del orden de α² ≈ 5·10⁻⁵ veces la energía del nivel. Es pequeño, "
        "pero es lo que explica el doblete amarillo del sodio."))


def cap9():
    d = D["helio"]
    E.append(PageBreak())
    E.append(h1("9 · Átomo polielectrónico: la aproximación de Hartree-Fock"))
    E.append(p(
        "A partir de dos electrones no hay solución exacta. Este capítulo desmonta la aproximación "
        "que usa la aplicación, pieza a pieza."))

    E.append(h2("9.1 · Por qué el problema exacto es imposible"))
    E.append(p("El hamiltoniano de un átomo de N electrones tiene tres términos:"))
    E.append(form("Ĥ = −½ Σ<sub>i</sub> ∇²<sub>i</sub>  −  Σ<sub>i</sub> Z/r<sub>i</sub>  +  "
                  "Σ<sub>i&lt;j</sub> 1/r<sub>ij</sub>"))
    E.append(p(
        "Los dos primeros son sumas de términos de <b>un</b> electrón: si estuvieran solos, la "
        "ecuación se separaría en N problemas de hidrógeno y habríamos terminado. El culpable es el "
        "tercero, la <b>repulsión electrón-electrón</b>: depende a la vez de dos posiciones, y con él "
        "la ecuación deja de ser separable. Ese término es la razón de que exista toda la química "
        "cuántica computacional."))

    E.append(h2("9.2 · Paso 1: la función de onda es un determinante"))
    E.append(p(
        "Los electrones son indistinguibles y fermiones: al intercambiar dos de ellos, la función de "
        "onda debe cambiar de signo. La forma más simple de garantizarlo es un <b>determinante de "
        "Slater</b>, donde cada fila es un electrón y cada columna un espín-orbital:"))
    E.append(form("Ψ = (N!)<sup>−½</sup> · det | φ₁(1) φ₂(2) … φ<sub>N</sub>(N) |"))
    E.append(p(
        "De aquí sale el principio de exclusión <b>sin postularlo</b>: si dos columnas fueran iguales "
        "—dos electrones en el mismo espín-orbital— el determinante valdría cero, es decir, ese estado "
        "no existe. La aplicación muestra el determinante concreto de cada sistema en el panel."))
    E.append(nota(
        "<b>Aquí está la primera aproximación.</b> La función de onda exacta <i>no</i> es un solo "
        "determinante: es una combinación de infinitos. Quedarse con uno es exactamente lo que "
        "significa «Hartree-Fock», y lo que se pierde por el camino tiene nombre propio: energía de "
        "correlación (§9.4)."))

    E.append(h2("9.3 · Paso 2: el campo medio, y las dos partes de la repulsión"))
    E.append(p(
        "Con un solo determinante, la energía se puede escribir de forma cerrada, y el problema se "
        "convierte en resolver una ecuación de <b>un</b> electrón que se mueve en el campo promedio "
        "de todos los demás. Ese operador es el de <b>Fock</b>:"))
    E.append(form("F̂ = ĥ  +  Σ<sub>j</sub> ( 2Ĵ<sub>j</sub> − K̂<sub>j</sub> )"))
    E.append(p("Los dos términos nuevos son de naturaleza muy distinta:"))
    E.append(li("<b>Ĵ, el término de Coulomb</b>: la repulsión electrostática contra la nube "
                "promedio del resto de electrones. Es lo que uno esperaría clásicamente."))
    E.append(li("<b>K̂, el término de intercambio</b>: no tiene análogo clásico. Aparece porque el "
                "determinante antisimetriza la función de onda, y su efecto es que dos electrones "
                "del <b>mismo espín</b> se evitan entre sí. Es la razón mecanocuántica de la regla de "
                "Hund y, con signo negativo, <i>baja</i> la energía."))
    E.append(nota(
        "Que Hartree-Fock incluya el intercambio pero no la correlación tiene una consecuencia curiosa: "
        "los electrones de <b>igual</b> espín sí se evitan (por antisimetría), pero los de espín "
        "<b>opuesto</b> se ignoran mutuamente salvo en promedio. La energía que falta es, casi toda, "
        "la de esos pares."))

    E.append(h2("9.4 · Paso 3: hay que iterar (el ciclo autoconsistente)"))
    E.append(p(
        "El operador de Fock depende de los orbitales que queremos encontrar: para construirlo hace "
        "falta ya conocer la solución. La salida es iterar hasta que la densidad que entra coincide "
        "con la que sale. En forma matricial, sobre una base finita, las ecuaciones son las de "
        "<b>Roothaan</b>:"))
    E.append(form("F C = S C ε"))
    E.append(figura("fig-hf-ciclo.png",
                    "Figura 4. El ciclo completo. La parte cara —las integrales— se hace una sola vez; "
                    "lo que se repite es construir F y diagonalizarlo.", ancho=14.6 * cm))
    E.append(p(
        "Tres mecanismos evitan que el ciclo oscile o se estanque: la <b>ortogonalización canónica</b> "
        "de S (que además descarta combinaciones casi linealmente dependientes), el <b>desplazamiento "
        "de nivel</b> y sobre todo <b>DIIS</b>, que extrapola el mejor Fock a partir de los errores "
        "anteriores. El criterio de parada no es solo que la energía deje de moverse —un ciclo "
        "estancado también cumpliría eso— sino que el gradiente ‖FPS − SPF‖ se anule."))
    E.append(figura("fig-scf.png",
                    "Figura 5. Convergencia del agua. La energía se estabiliza en pocos ciclos, pero "
                    "es el error de la derecha (escala logarítmica) el que decide: cae seis órdenes "
                    "de magnitud gracias a DIIS.", ancho=14.6 * cm))
    E.append(p(
        "Para capa cerrada se usa <b>RHF</b> (electrones de dos en dos en el mismo orbital espacial). "
        "Para radicales, iones y para el O₂ se usa <b>UHF</b>, donde α y β tienen orbitales distintos; "
        "el precio es que Ψ deja de ser función propia de S², y la aplicación muestra ⟨S²⟩ para que "
        "se vea cuánta contaminación de espín hay."))

    E.append(h2("9.5 · Qué queda fuera: la correlación electrónica"))
    E.append(p(
        "Aunque la base fuera infinita, Hartree-Fock no daría la energía exacta: le falta que cada "
        "electrón esquive a los demás <b>instantáneamente</b>, no solo en promedio. La diferencia se "
        "llama <b>energía de correlación</b> y se define justo así:"))
    E.append(form("E<sub>correlación</sub> = E<sub>exacta</sub> − E<sub>límite Hartree-Fock</sub>"))
    E.append(figura("fig-correlacion.png",
                    "Figura 6. Cada escalón es una base mejor. Ampliarla acerca al <i>límite "
                    "Hartree-Fock</i>, pero nunca lo cruza: el hueco que queda hasta la energía exacta "
                    "es la correlación, y no se cierra con más base sino con otro método.",
                    ancho=15.0 * cm))
    c = D["correlacion"]
    filas = [[x["sym"], f"{x['sz']:.4f}", f"{x['dz4']:.4f}", f"{x['et']:.4f}",
              f"{x['hf']:.4f}", f"{x['exacta']:.4f}",
              f"{x['correlacion'] * 27.2114:.2f} eV"] for x in c]
    E.append(tabla([["Átomo", "base mínima", "doble ζ (4G)", "even-tempered", "límite HF",
                     "exacta", "correlación"]] + filas,
                   [1.6 * cm, 2.4 * cm, 2.4 * cm, 2.6 * cm, 2.4 * cm, 2.4 * cm, 2.4 * cm], size=7.4,
                   align={1: "RIGHT", 2: "RIGHT", 3: "RIGHT", 4: "RIGHT", 5: "RIGHT", 6: "CENTER"}))
    E.append(p(
        "Es una cantidad pequeña frente al total —en el neón, un 0,3 %— pero enorme frente a lo que "
        "distingue una reacción de otra: 10,6 eV son más de dos veces la energía de un enlace O–H. "
        "Por eso los métodos que recuperan correlación son el grueso de la química cuántica moderna, "
        "y por eso esta aplicación avisa de que sus energías de disociación salen cortas."))

    E.append(h2("9.6 · De dónde salen los orbitales de partida: las reglas de Slater"))
    E.append(p(
        "El SCF necesita una base de funciones. La aplicación no las saca de una tabla: las construye "
        "con las <b>reglas de Slater</b>, una receta empírica de 1930 que sigue siendo la mejor "
        "manera de entender por qué los orbitales tienen el tamaño que tienen."))
    E.append(p("La idea es que un electrón no siente la carga completa del núcleo, porque los demás "
               "electrones se interponen. Siente una <b>carga nuclear efectiva</b>:"))
    E.append(form("Z<sub>ef</sub> = Z − σ            ζ = Z<sub>ef</sub> / n*"))
    E.append(h3("Qué es cada símbolo"))
    E.append(tabla([["Símbolo", "Se lee", "Qué es"],
                    ["Z", "«zeta mayúscula»", "la carga del núcleo: el número atómico"],
                    ["σ", "«sigma»", "el <b>apantallamiento</b>: cuánta carga nuclear le tapan al "
                     "electrón sus compañeros. Se suma con las reglas de la tabla siguiente"],
                    ["Z<sub>ef</sub>", "«zeta efectiva»", "la carga que el electrón realmente siente"],
                    ["n*", "«ene estrella»", "el número cuántico principal <b>efectivo</b>. Vale n "
                     "hasta n = 3, pero luego se queda corto (n = 4 → 3,7; n = 5 → 4,0): es un ajuste "
                     "empírico a lo que se observa"],
                    ["ζ", "«dseta» (zeta griega)", "el <b>exponente</b> del orbital: gobierna lo "
                     "deprisa que decae, e<sup>−ζr</sup>. ζ grande = orbital compacto, pegado al "
                     "núcleo; ζ pequeño = orbital difuso"]],
                   [2.0 * cm, 2.8 * cm, 11.0 * cm]))
    E.append(nota(
        "<b>Ese es el «símbolo raro»</b>: ζ, la letra griega dseta. Aparece por toda la aplicación "
        "—«Escala de ζ», «Optimizar ζ»— porque es el único parámetro que controla el tamaño de las "
        "funciones de base, y por tanto la palanca natural para el teorema variacional (§9.8)."))
    E.append(h3("Las reglas de apantallamiento"))
    E.append(tabla([["Quién apantalla al electrón (n, ℓ)", "Cuánto suma a σ"],
                    ["otro electrón del mismo grupo (ns, np)", "0,35   (0,30 si es el 1s)"],
                    ["cada electrón de la capa n − 1", "0,85"],
                    ["cada electrón de capas más internas (≤ n − 2)", "1,00 (apantalla del todo)"],
                    ["para un electrón d o f: todo lo que no sea su grupo", "1,00"]],
                   [9.6 * cm, 6.2 * cm]))
    E.append(h3("Ejemplos resueltos por la propia aplicación"))
    for a in D["slater"]:
        filas = [[c["label"], str(c["occ"]), f"{c['sigma']:.2f}", f"{c['zeff']:.2f}",
                  f"{c['nstar']:g}", f"{c['zeta']:.3f}"] for c in a["capas"]]
        E.append(Paragraph(f"<b>{a['sym']}</b>  (Z = {a['Z']}) · {a['cfg']}",
                           ParagraphStyle("SL", parent=P, fontSize=8.4, spaceBefore=5, spaceAfter=2)))
        E.append(tabla([["subcapa", "e⁻", "σ", "Z<sub>ef</sub>", "n*", "ζ"]] + filas,
                       [2.2 * cm, 1.6 * cm, 2.0 * cm, 2.2 * cm, 1.6 * cm, 2.0 * cm], size=7.4,
                       align={1: "CENTER", 2: "CENTER", 3: "CENTER", 4: "CENTER", 5: "CENTER"}))
    E.append(p(
        "Estos números explican de un vistazo dos hechos que en clase se aprenden de memoria. "
        "Primero, <b>por qué el radio atómico disminuye a lo largo de un periodo</b>: del carbono al "
        "oxígeno, Z sube de 6 a 8 pero σ solo de 2,75 a 3,45, así que Z<sub>ef</sub> crece de 3,25 a "
        "4,55 y los orbitales se contraen. Segundo, <b>por qué el 4s del calcio es tan grande</b>: su "
        "Z<sub>ef</sub> es apenas 2,85 —de veinte protones— y encima se divide por n* = 3,7."))

    E.append(h2("9.7 · De los orbitales de Slater a las gaussianas"))
    E.append(p(
        "Un orbital de Slater r<sup>n−1</sup>e<sup>−ζr</sup> tiene la forma correcta, pero produce "
        "integrales de cuatro centros imposibles de resolver. La salida clásica es imitarlo con "
        "<b>gaussianas</b>, porque el producto de dos gaussianas centradas en sitios distintos "
        "<i>es</i> otra gaussiana centrada en un punto intermedio. Eso convierte el problema en "
        "calculable. El precio se ve en la figura:"))
    E.append(figura("fig-stong.png",
                    "Figura 7. Ajuste de un orbital 1s por n gaussianas. Con tres ya es bueno lejos "
                    "del núcleo; en el detalle se ve el defecto que ninguna suma de gaussianas puede "
                    "arreglar: la <b>cúspide</b>, el pico afilado sobre el núcleo.", ancho=14.6 * cm))
    E.append(nota(
        "<b>Esto tiene consecuencias visibles.</b> La cúspide que falta rebaja la densidad justo sobre "
        "los núcleos. Con bases muy pobres, el máximo de densidad sobre un hidrógeno puede llegar a "
        "desaparecer; entonces ese átomo se queda sin cuenca y sin punto crítico de enlace, y el "
        "análisis del capítulo 11 falla. La aplicación lo detecta y te sugiere subir la base.", WARN))
    E.append(tabla([["Calidad", "Qué añade", "Para qué"],
                    ["Mínima (SZ)", "una función por subcapa", "rápida; suficiente para ver formas"],
                    ["Doble ζ (DZ)", "la valencia se desdobla en dos", "el enlace puede contraerse o expandirse"],
                    ["+ difusas", "una función muy extendida", "imprescindible en aniones (F⁻, OH⁻)"],
                    ["+ polarización", "una función de ℓ superior", "permite que los orbitales se deformen"]],
                   [3.2 * cm, 5.6 * cm, 7.0 * cm]))

    E.append(h2("9.8 · El teorema variacional, en directo"))
    E.append(p(
        "Cualquier función de prueba da una energía <b>por encima</b> de la exacta. Por tanto, bajar "
        "la energía es acercarse a la verdad, y se puede optimizar cualquier parámetro sin conocer la "
        "solución. La aplicación lo enseña con el helio: el botón <b>⚡ Optimizar ζ</b> recorre el "
        "exponente y dibuja la curva."))
    E.append(figura("fig-variacional.png",
                    f"Figura 8. El mínimo cae en ζ = {d['mejor']['zeta']:.4f}: exactamente el "
                    "27/16 = 1,6875 de los libros de texto. Cada electrón apantalla al otro en 5/16 "
                    "de carga nuclear.", ancho=11.6 * cm))
    E.append(p(
        "Fíjate en que la curva es la demostración de por qué el teorema es útil: no hemos necesitado "
        "saber la respuesta para encontrarla. Basta con que la energía sea una cota superior."))


def cap10():
    E.append(PageBreak())
    E.append(h1("10 · Moléculas"))
    E.append(p(
        "En una molécula la única diferencia formal es que las funciones de base están centradas en "
        "núcleos distintos. De ahí sale, sin postularlo, el principio <b>LCAO</b>: los orbitales "
        "moleculares son combinaciones lineales de orbitales atómicos, y los coeficientes los fija el "
        "propio SCF."))
    E.append(h2("10.1 · Los niveles y su composición"))
    E.append(figura("fig-om.png",
                    "Figura 9. Orbitales de valencia del nitrógeno y del agua, con la composición "
                    "atómica dominante de cada uno. La capa interna queda muy por debajo y se indica "
                    "aparte para no aplastar la escala.", ancho=14.4 * cm))
    E.append(p(
        "El panel indica para cada orbital qué orbitales atómicos lo forman y en qué proporción. Con "
        "eso se leen de un vistazo las historias clásicas: en el N₂, los enlaces π degenerados por "
        "debajo del σ; en el agua, un orbital que es esencialmente un <b>par solitario</b> del "
        "oxígeno, casi sin participación de los hidrógenos. Los botones <b>Ir al HOMO</b> y <b>Ir al LUMO</b> "
        "llevan directamente a los dos que gobiernan la reactividad."))
    E.append(h2("10.2 · La curva de energía potencial"))
    E.append(figura("fig-er.png",
                    "Figura 10. Curvas E(R) con base doble ζ. Las distancias de equilibrio salen muy "
                    "cerca de las experimentales; las profundidades, no tanto — y esa diferencia es "
                    "justamente lo que Hartree-Fock no puede dar.", ancho=14.6 * cm))
    er = {x["key"]: x for x in D["er"]}
    filas = [[qf(k), f"{er[k]['Req']:.3f}", f"{er[k]['Rexp']:.3f}",
              f"{100 * abs(er[k]['Req'] - er[k]['Rexp']) / er[k]['Rexp']:.1f} %"] for k in er]
    E.append(tabla([["Molécula", "R equilibrio calc. (Å)", "R experimental (Å)", "desviación"]] + filas,
                   [3.4 * cm, 4.6 * cm, 4.4 * cm, 3.0 * cm],
                   align={1: "CENTER", 2: "CENTER", 3: "CENTER"}))
    E.append(nota(
        "<b>Por qué la disociación sale mal.</b> Al separar una molécula de capa cerrada, RHF obliga "
        "a los dos electrones a compartir el mismo orbital espacial, lo que fuerza soluciones iónicas "
        "(H⁺ + H⁻) que no corresponden a la realidad (H + H). Es el fallo más famoso del método, y la "
        "aplicación lo deja ver en lugar de esconderlo: la rama derecha de la curva sube demasiado.",
        WARN))
    E.append(h2("10.3 · Cargas atómicas: dos maneras de repartir"))
    E.append(p(
        "«Cuánta carga tiene este átomo» no es una pregunta con respuesta única: el electrón no lleva "
        "etiqueta. La aplicación ofrece las dos particiones habituales, y compararlas es en sí una "
        "lección:"))
    E.append(li("<b>Mulliken</b>: reparte según las funciones de base. Es inmediato pero depende "
                "muchísimo de la base elegida; puede dar resultados absurdos."))
    E.append(li("<b>Bader</b> (capítulo 11): reparte el espacio según la propia densidad electrónica, "
                "sin referencia a la base. Es más caro pero mucho más robusto."))
    b = {x["key"]: x for x in D["bader"]}
    filas = []
    for k in ("LiF", "CO", "H2O", "CH4"):
        at = b[k]["atomos"]
        filas.append([qf(k),
                      "  ·  ".join(f"{a['sym']} {a['mulliken']:+.2f}" for a in at[:3]),
                      "  ·  ".join(f"{a['sym']} {a['bader']:+.2f}" for a in at[:3])])
    E.append(tabla([["Molécula", "Mulliken", "Bader"]] + filas,
                   [2.8 * cm, 6.4 * cm, 6.2 * cm]))
    E.append(p(
        "El caso del <b>CO</b> es el más elocuente: Mulliken da cargas casi nulas mientras que Bader "
        "encuentra una separación de más de un electrón. En el <b>LiF</b> las dos coinciden, porque "
        "el enlace iónico no deja lugar a dudas."))


def cap11():
    E.append(PageBreak())
    E.append(h1("11 · QTAIM: los átomos dentro de la molécula"))
    E.append(p(
        "La teoría de <b>átomos en moléculas</b> de Richard Bader parte de una idea austera: la "
        "densidad electrónica ρ(r) es un observable —se mide por difracción de rayos X— y toda la "
        "información química está en su forma. No hacen falta orbitales, que son constructos "
        "matemáticos; basta con estudiar la topología de un campo escalar."))
    E.append(h2("11.1 · Los puntos críticos"))
    E.append(p(
        "Donde el gradiente se anula hay un punto crítico. Las tres curvaturas (los autovalores del "
        "hessiano) lo clasifican, y cada tipo corresponde a un objeto químico:"))
    E.append(tabla([["Tipo", "Curvaturas", "Significa"],
                    ["(3, −3)  núcleo", "las tres negativas: máximo", "un átomo"],
                    ["(3, −1)  enlace", "dos negativas, una positiva: silla", "un enlace: el BCP"],
                    ["(3, +1)  anillo", "una negativa, dos positivas: silla", "un ciclo (benceno, H₃⁺)"],
                    ["(3, +3)  caja", "las tres positivas: mínimo", "una cavidad (cubano)"],
                    ["(3, −3)  no nuclear", "máximo, pero sin núcleo debajo",
                     "un atractor no nuclear (ver recuadro)"]],
                   [4.0 * cm, 6.2 * cm, 6.0 * cm]))
    E.append(nota(
        "<b>Un caso que sorprende: los atractores no nucleares.</b> A veces ρ tiene un <i>máximo</i> "
        "que no está sobre ningún núcleo, típicamente en mitad de un enlace. La aplicación lo marca "
        "con una esfera azul claro y lo cuenta como atractor en la relación de Poincaré-Hopf, porque "
        "lo es: define su propia cuenca. En los metales alcalinos —el Li₂ es el ejemplo de libro— es "
        "un fenómeno <b>real</b>. Pero en enlaces homonucleares corrientes suele ser un <b>artefacto "
        "de la base</b>: aparece y desaparece al cambiarla, y la diferencia de densidad con su "
        "entorno es de milésimas. La regla práctica: si no sobrevive a mejorar la base, no era real."))
    E.append(p(
        "Y no pueden aparecer en cualquier combinación: la relación de <b>Poincaré-Hopf</b> obliga a "
        "que n − b + r − c = 1 en una molécula aislada. La aplicación la muestra siempre y funciona "
        "como control de calidad automático: si no da 1, falta o sobra algo."))
    E.append(figura("fig-mapa-h2o.png",
                    "Figura 11. El agua en su plano molecular: densidad en escala logarítmica, los "
                    "tres núcleos (máximos), los dos puntos críticos de enlace (sillas) y los caminos "
                    "que los unen. 3 − 2 + 0 − 0 = 1.", ancho=10.8 * cm))
    E.append(p(
        "Los <b>caminos de enlace</b> se obtienen integrando el gradiente desde cada punto crítico "
        "hacia los dos núcleos: son las líneas de máxima densidad que conectan átomos enlazados. En "
        "moléculas tensionadas se curvan visiblemente, y esa curvatura mide la tensión."))
    E.append(nota(
        "<b>Estirar un enlace es un buen experimento.</b> Con el control <b>Distancia de enlace (×)</b> "
        "de una diatómica puedes alejar los núcleos y ver cómo el punto crítico se mantiene mientras "
        "ρ<sub>b</sub> cae: la densidad acumulada entre los núcleos es, literalmente, la medida de "
        "cuánto enlace queda. El punto no desaparece por estirar —el enlace se debilita, no se "
        "corta— hasta distancias muy grandes."))
    E.append(figura("fig-mapa-c2h4.png",
                    "Figura 12. El etileno, con sus cinco enlaces y ningún anillo: 6 − 5 = 1.",
                    ancho=10.4 * cm))
    E.append(h2("11.2 · Qué tipo de enlace es"))
    E.append(p(
        "En el punto crítico de enlace se leen varios indicadores. El más elocuente es el signo del "
        "laplaciano: negativo significa que la carga está <b>concentrada</b> entre los núcleos "
        "(enlace compartido, covalente); positivo, que está <b>replegada</b> sobre cada átomo "
        "(interacción de capa cerrada: iónico, puente de hidrógeno, van der Waals)."))
    E.append(nota(
        "<b>Cuidado con una lectura muy tentadora.</b> Que una zona salga roja (∇²ρ &lt; 0, carga "
        "concentrada) <i>no</i> significa que los electrones «fluyan» hacia allí, ni que la zona azul "
        "sea donde «se repelen». El laplaciano es una <b>segunda derivada</b>: compara la densidad de "
        "un punto con el promedio de su entorno inmediato. Rojo quiere decir que ahí la nube está "
        "<b>amontonada</b> respecto de alrededor —un bulto—, y azul que está <b>ahuecada</b>. Es una "
        "propiedad estática de cómo está repartida la carga, no un movimiento. Lo que sí tiene "
        "sentido de «hacia dónde» es la <b>primera</b> derivada, ∇ρ, y se puede dibujar con la "
        "opción <b>Campo vectorial ∇ρ</b> (§3.9)."))
    E.append(p(
        "La utilidad química de las zonas rojas es otra, y es grande: coinciden con los pares "
        "electrónicos de Lewis —enlazantes y solitarios— y por eso el mapa del laplaciano se usa para "
        "predecir por dónde ataca un reactivo. Un electrófilo, que busca carga, se dirige a una "
        "concentración; un nucleófilo, a un hueco de la capa de valencia."))
    E.append(figura("fig-perfil.png",
                    "Figura 13. El mismo análisis en dos enlaces opuestos. En el N₂ la densidad en el "
                    "punto crítico es alta y ∇²ρ &lt; 0. En el LiF es diez veces menor y ∇²ρ &gt; 0: "
                    "dos iones que se tocan, no un par compartido.", ancho=12.8 * cm))
    per = {x["key"]: x for x in D["perfiles"]}
    filas = [[qf(k), f"{per[k]['bcp']['rho']:.3f}", f"{per[k]['bcp']['lap']:+.3f}",
              f"{per[k]['bcp']['H']:+.3f}",
              "compartido (covalente)" if per[k]["bcp"]["lap"] < 0 else "capa cerrada (iónico)"]
             for k in per]
    E.append(tabla([["Enlace", "ρ en el BCP", "∇²ρ", "H = G + V", "clasificación"]] + filas,
                   [2.4 * cm, 3.0 * cm, 2.6 * cm, 2.8 * cm, 5.0 * cm],
                   align={1: "CENTER", 2: "CENTER", 3: "CENTER"}))
    E.append(p(
        "La <b>elipticidad</b> ε mide cuánto se aparta el enlace de la simetría cilíndrica: es "
        "prácticamente cero en un enlace sencillo C–H y sube a ≈ 0,25 en el doble enlace C=C del "
        "etileno, porque la componente π reparte la densidad de forma distinta en las dos direcciones "
        "perpendiculares. Es una medida cuantitativa del «carácter π»."))
    E.append(h2("11.3 · El laplaciano y la ELF"))
    E.append(figura("fig-lap-elf.png",
                    "Figura 14. Izquierda: −∇²ρ del agua; las zonas azules son concentraciones de "
                    "carga y se ven las capas atómicas. Derecha: la función de localización "
                    "electrónica, que separa con claridad los dos enlaces O–H del par solitario.",
                    ancho=14.6 * cm))
    E.append(p(
        "La <b>ELF</b> mide, en cada punto, la probabilidad de encontrar un segundo electrón del "
        "mismo espín cerca: donde vale casi 1 hay un par electrónico bien localizado. Es la "
        "traducción cuantitativa de las estructuras de Lewis y, en el agua, dibuja exactamente lo que "
        "se enseña en clase. Ambos campos se pueden ver en 3D dentro de la escena (receta en §4)."))
    E.append(h2("11.4 · Las cuencas atómicas y las cargas de Bader"))
    E.append(p(
        "Las superficies donde el gradiente no tiene componente perpendicular (superficies de "
        "<b>flujo cero</b>) parten el espacio en regiones, una por átomo. Integrar ρ dentro de cada "
        "una da el número de electrones que le corresponde, y con él su carga. Es la única partición "
        "que no depende de la base."))
    E.append(p(
        "Esas superficies se pueden ver de forma muy directa activando <b>Campo vectorial ∇ρ</b>: "
        "cada flecha apunta hacia donde la densidad <i>crece</i>, y si te dejas llevar por ellas "
        "siempre acabas en un núcleo. El conjunto de puntos cuyas flechas llevan al mismo núcleo es "
        "su cuenca; la superficie donde los haces se separan —la que ninguna flecha cruza— es "
        "precisamente la de flujo cero. Es la imagen de la que salieron las cargas de la tabla."))
    E.append(p(
        "El cálculo se hace sobre una rejilla con el <b>método de pesos</b> de Yu y Trinkle: se "
        "recorren las celdas de mayor a menor densidad y cada una reparte su pertenencia entre las "
        "vecinas más densas, en proporción al flujo que va hacia ellas. Las celdas del interior "
        "reciben un único dueño; solo las de la superficie quedan repartidas, con lo que la frontera "
        "es suave y —esto es lo importante— <b>el resultado no depende de cómo caiga la rejilla</b>."))
    filas = []
    for x in D["bader"]:
        filas.append([qf(x["key"]),
                      "   ".join(f"{a['sym']} {a['bader']:+.3f}" for a in x["atomos"]),
                      f"{x['suma']:+.4f}"])
    E.append(tabla([["Molécula", "Cargas de Bader", "suma"]] + filas,
                   [2.8 * cm, 9.6 * cm, 3.0 * cm], align={2: "CENTER"}))
    E.append(nota(
        "Dos comprobaciones que conviene hacer en clase: la <b>suma</b> de las cargas tiene que dar la "
        "carga total del sistema (aquí, cero) y en una molécula <b>simétrica</b> los átomos "
        "equivalentes deben salir idénticos. El N₂ da exactamente 0,000 y −0,000; los cuatro "
        "hidrógenos del metano, el mismo número hasta la última cifra."))


# ===========================================================================
# PARTE III
# ===========================================================================
def cap12():
    parte("III", "Referencia", "Los símbolos, las comprobaciones, el guion de divulgación y el glosario.")
    E.append(PageBreak())
    E.append(h1("12 · Notación: qué significa cada símbolo"))
    E.append(p(
        "La química cuántica usa el alfabeto griego sin piedad. Esta tabla recoge todos los símbolos "
        "que aparecen en la aplicación y en esta guía, con su lectura en voz alta."))
    simbolos = [
        ("ψ, Ψ", "«psi»", "Función de onda. Minúscula para un orbital (un electrón), mayúscula para "
                          "el sistema completo. No se mide; su cuadrado sí."),
        ("|ψ|²", "«psi al cuadrado»", "Densidad de probabilidad: dónde es probable encontrar el electrón."),
        ("φ", "«fi»", "Un orbital individual dentro del determinante."),
        ("ρ", "«ro»", "Densidad electrónica total, en electrones por bohr³. Es un observable."),
        ("∇²ρ", "«laplaciano de ro»", "Suma de las tres curvaturas de ρ. Negativo = carga concentrada."),
        ("ζ", "«dseta»", "Exponente de una función de base: controla su tamaño."),
        ("σ", "«sigma»", "Apantallamiento en las reglas de Slater (también: enlace de tipo σ)."),
        ("Z, Z<sub>ef</sub>", "«zeta», «zeta efectiva»", "Carga del núcleo y la que el electrón siente."),
        ("n*", "«ene estrella»", "Número cuántico principal efectivo de las reglas de Slater."),
        ("n, ℓ, m", "«ene, ele, eme»", "Números cuánticos: capa, forma y orientación."),
        ("m<sub>s</sub>, j, m<sub>j</sub>", "«eme sub ese», «jota»",
         "Proyección del espín; momento angular total y su proyección."),
        ("ε", "«épsilon»", "Energía de un orbital (no del sistema)."),
        ("Ĥ, F̂", "«hamiltoniano», «operador de Fock»", "El operador de la energía y su versión de campo medio."),
        ("Ĵ, K̂", "«jota», «ka»", "Repulsión de Coulomb promedio y término de intercambio."),
        ("S, C, P", "—", "Matrices de solapamiento, de coeficientes y de densidad."),
        ("(μν|λσ)", "«mu nu, lambda sigma»", "Integral de repulsión entre dos pares de funciones de base."),
        ("⟨r⟩, ⟨S²⟩", "«valor esperado de…»", "Promedio de una magnitud sobre la función de onda."),
        ("E<sub>h</sub>", "«hartree»", "Unidad atómica de energía: 27,211 eV."),
        ("a₀", "«a sub cero»", "Radio de Bohr, unidad atómica de longitud: 0,529 Å."),
        ("α, β", "«alfa», «beta»", "Los dos estados de espín del electrón."),
    ]
    E.append(tabla([[s, l, Paragraph(d, ParagraphStyle("SM", parent=P, fontSize=7.6, leading=10.6,
                                                       spaceAfter=0))] for s, l, d in simbolos],
                   [2.2 * cm, 3.0 * cm, 10.6 * cm], cabecera=False, size=7.8))


def cap13():
    E.append(PageBreak())
    E.append(h1("13 · Validación y límites conocidos"))
    E.append(p(
        "Un programa de cálculo que no se contrasta no vale nada. Estas tablas se regeneran "
        "ejecutando <font face='DJM' size='8'>node scripts/guia-datos.mjs</font>, de modo que "
        "cualquiera puede reproducirlas."))
    E.append(h2("13.1 · Átomos: cuánto se acerca cada base"))
    E.append(p(
        "El teorema variacional da una prueba muy exigente: la energía calculada tiene que quedar "
        "<b>por encima</b> del límite Hartree-Fock y acercarse a él al ampliar la base. Si alguna vez "
        "quedara por debajo, habría un error en el programa."))
    filas = []
    for a in D["atomos"]:
        if not a["hf"]:
            continue
        filas.append([a["sym"], a["cfg"], f"{a['sz']:.4f}", f"{a['dz']:.4f}",
                      f"{a['dz4']:.4f}", f"{a['hf']:.4f}", f"{100 * a['dz4'] / a['hf']:.2f} %"])
    E.append(tabla([["Át.", "configuración", "mínima", "doble ζ", "doble ζ, 4G", "límite HF", "% (4G)"]] + filas,
                   [1.2 * cm, 3.2 * cm, 2.3 * cm, 2.3 * cm, 2.5 * cm, 2.4 * cm, 2.3 * cm], size=7.4,
                   align={2: "RIGHT", 3: "RIGHT", 4: "RIGHT", 5: "RIGHT", 6: "CENTER"}))
    E.append(figura("fig-validacion.png",
                    "Figura 15. Ninguna barra pasa del 100 %: el teorema variacional se cumple en "
                    "todos los casos. Ampliar la base siempre acerca al límite, nunca lo cruza.",
                    ancho=14.6 * cm))
    E.append(h2("13.2 · Moléculas: energía y topología"))
    filas = []
    for m in D["moleculas"]:
        d4 = m["dz4"]
        c = d4["counts"]
        filas.append([qf(m["key"]), str(m["nat"]), str(d4["nbf"]), d4["metodo"],
                      f"{d4['E']:.4f}", f"{c['NCP']}/{c['BCP']}/{c['RCP']}/{c['CCP']}",
                      "✓" if d4["poincare"] == 1 else str(d4["poincare"])])
    E.append(tabla([["Molécula", "át.", "func.", "método", "E total (Eh)", "n/b/r/c", "P-H"]] + filas,
                   [3.0 * cm, 1.2 * cm, 1.4 * cm, 1.8 * cm, 3.4 * cm, 2.6 * cm, 1.4 * cm], size=7.2,
                   align={1: "CENTER", 2: "CENTER", 3: "CENTER", 4: "RIGHT", 5: "CENTER", 6: "CENTER"}))
    E.append(p("Base doble ζ con cuatro gaussianas por función. Las 27 moléculas del catálogo (el "
               "benceno se omite por tiempo de cálculo) dan la topología correcta."))
    E.append(h2("13.3 · Lo que esta aplicación no hace"))
    E.append(li("<b>No incluye correlación electrónica</b> (§9.5). En el helio faltan 1,14 eV; en el "
                "neón, 10,6 eV."))
    E.append(li("<b>No optimiza geometrías.</b> Las del catálogo son experimentales; solo las "
                "diatómicas permiten variar la distancia."))
    E.append(li("<b>No pasa de Z = 20</b> y solo usa funciones s, p y d."))
    E.append(li("<b>Con base mínima, algunos hidrógenos pierden su cuenca</b> (HeH⁺, H₃O⁺, NH₄⁺): la "
                "densidad sobre ellos se aplana tanto que deja de ser un máximo. No es un error de "
                "programación sino el límite de la base; la aplicación lo detecta y lo dice."))
    E.append(li("<b>Las cargas de Bader dependen de la base</b> más de lo que sugiere su reputación "
                "de robustez: en el metano, con las bases pequeñas de esta aplicación, el carbono "
                "sale ligeramente positivo mientras que con bases grandes la bibliografía da negativo."))


def cap14():
    E.append(PageBreak())
    E.append(h1("14 · Guion de divulgación"))
    E.append(p(
        "Nueve demostraciones probadas, con lo que hay que tocar y lo que conviene contar. Cada una "
        "cabe en tres o cuatro minutos."))
    demos = [
        ("1. El orbital no es una órbita", "Hidrógeno, orbital 1s, nube de puntos.",
         "Cada punto es un sitio donde <i>podría</i> estar el electrón. No hay trayectoria: hay una "
         "probabilidad. Súbelo a 2s y aparece la capa vacía intermedia — el nodo."),
        ("2. Los nodos y el signo", "Hidrógeno, orbital 2p, isosuperficie con signo.",
         "Los dos lóbulos tienen signos opuestos y entre ellos la función vale exactamente cero. Ese "
         "cambio de signo es lo que permite que dos orbitales se cancelen y aparezca un orbital "
         "antienlazante."),
        ("3. Por qué el 1s tiene su radio", "Hidrógeno, gráfica r²|R|² frente a r.",
         "La densidad es máxima en el núcleo, pero el volumen disponible crece como r². El producto "
         "tiene su máximo exactamente en un radio de Bohr."),
        ("4. La cuantización, sin fórmulas", "Partícula en una caja 1D; mover n y L.",
         "Solo caben números enteros de semiondas: de ahí salen los niveles. Al hacer la caja cúbica, "
         "estados distintos coinciden en energía: eso es una degeneración."),
        ("5. La hibridación no es física nueva", "Modelo híbridos: sp, sp², sp³.",
         "Son combinaciones del 2s con los 2p. Si sumas la densidad de los cuatro sp³ recuperas la de "
         "2s + 2p: la hibridación reorganiza, no crea."),
        ("6. El teorema variacional en directo", "Átomo He, botón «Optimizar ζ».",
         "Probamos exponentes y nos quedamos con el de menor energía. Sale 1,6875 = 27/16: cada "
         "electrón apantalla al otro en 5/16 de carga nuclear."),
        ("7. Covalente contra iónico, medido", "Molécula N₂ y luego LiF, campo ρ, QTAIM activado.",
         "En el N₂ hay mucha densidad entre los núcleos y ∇²ρ &lt; 0: par compartido. En el LiF la "
         "densidad en el punto crítico es diez veces menor y ∇²ρ &gt; 0: dos iones que se tocan. La "
         "diferencia entre los dos tipos de enlace deja de ser una etiqueta y pasa a ser un número."),
        ("8. Los pares solitarios existen", "Molécula H₂O, campo ELF, nivel iso 0,4 (ELF = 0,8).",
         "Aparecen cuatro regiones: dos enlaces O–H y dos pares solitarios, en la disposición "
         "tetraédrica que predice la teoría de repulsión de pares. Lewis dibujado por la mecánica "
         "cuántica."),
        ("9. Entrar dentro de la molécula", "Cualquier sistema, botón ENTER VR.",
         "Rodear un orbital d o un enlace π en tamaño natural arregla, en treinta segundos, "
         "confusiones que en la pizarra duran un curso."),
    ]
    for titulo, ajustes, guion in demos:
        E.append(h3(titulo))
        E.append(Paragraph(f"<b>Ajustes:</b> {ajustes}", ParagraphStyle(
            "AJ", parent=P, fontSize=8.4, textColor=MUTED, spaceAfter=2)))
        E.append(p(guion))
    E.append(nota(
        "<b>Consejo de sala.</b> Empieza siempre por la nube de puntos, no por la isosuperficie: la "
        "isosuperficie es preciosa pero induce a pensar que el orbital es un objeto sólido con "
        "frontera. La nube transmite lo que de verdad es —una distribución de probabilidad— y después "
        "la isosuperficie se entiende como lo que es: una curva de nivel."))


def cap15():
    E.append(PageBreak())
    E.append(h1("15 · Glosario"))
    terms = [
        ("Unidades atómicas", "El sistema en el que ħ = m<sub>e</sub> = e = 1. La unidad de longitud "
                              "es el bohr (0,529 Å) y la de energía el hartree (27,211 eV)."),
        ("Base", "El conjunto de funciones fijas con las que se construyen los orbitales. Toda la "
                 "calidad del cálculo depende de ella."),
        ("STO-nG", "Un orbital de Slater imitado por n gaussianas: se pierde la cúspide pero las "
                   "integrales se vuelven calculables."),
        ("SCF", "Ciclo autoconsistente: se repite el cálculo hasta que la densidad que entra "
                "coincide con la que sale."),
        ("DIIS", "Técnica que acelera ese ciclo extrapolando a partir de los errores anteriores."),
        ("RHF / UHF", "Hartree-Fock restringido (electrones apareados) y no restringido (α y β con "
                      "orbitales distintos, necesario en capa abierta)."),
        ("HOMO / LUMO", "El orbital ocupado de mayor energía y el vacío de menor energía; entre los "
                        "dos se juega casi toda la reactividad."),
        ("Intercambio", "Término del operador de Fock, sin análogo clásico, que hace que dos "
                        "electrones del mismo espín se eviten."),
        ("Correlación electrónica", "Lo que Hartree-Fock no captura: que cada electrón evita a los "
                                    "demás instantáneamente, no solo en promedio."),
        ("Apantallamiento (σ)", "La parte de la carga nuclear que los demás electrones «tapan»."),
        ("BCP", "Punto crítico de enlace: la silla de ρ entre dos átomos enlazados."),
        ("Camino de enlace", "La línea de máxima densidad que une dos núcleos a través de su BCP."),
        ("Cuenca atómica", "La región del espacio que «pertenece» a un átomo según el criterio de "
                           "flujo cero de ∇ρ."),
        ("ELF", "Función de localización electrónica: vale casi 1 donde hay un par electrónico bien "
                "localizado."),
        ("Elipticidad", "Medida de la asimetría de la densidad en un enlace; cuantifica el carácter π."),
        ("Poincaré-Hopf", "La relación n − b + r − c = 1 que deben cumplir los puntos críticos de una "
                          "molécula aislada."),
    ]
    E.append(tabla([[t, Paragraph(d, ParagraphStyle("G", parent=P, fontSize=8, leading=11.5,
                                                    spaceAfter=0))] for t, d in terms],
                   [3.8 * cm, 12.0 * cm], cabecera=False, size=8))
    E.append(h2("Para seguir leyendo"))
    E.append(li("A. Szabo y N. S. Ostlund, <i>Modern Quantum Chemistry</i> — la referencia clásica de "
                "Hartree-Fock, con el mismo formalismo que usa esta aplicación."))
    E.append(li("R. F. W. Bader, <i>Atoms in Molecules: A Quantum Theory</i> — el libro que fundó el "
                "análisis del capítulo 11."))
    E.append(li("J. C. Slater, <i>Phys. Rev.</i> 36, 57 (1930) — las reglas de apantallamiento del §9.6."))
    E.append(li("L. E. McMurchie y E. R. Davidson, <i>J. Comput. Phys.</i> 26, 218 (1978) — el método "
                "con el que se calculan las integrales."))
    E.append(li("M. Yu y D. R. Trinkle, <i>J. Chem. Phys.</i> 134, 064111 (2011) — el método de pesos "
                "para las cuencas de Bader."))
    E.append(li("W. J. Hehre, R. F. Stewart y J. A. Pople, <i>J. Chem. Phys.</i> 51, 2657 (1969) — el "
                "origen de las bases STO-nG."))
    E.append(Spacer(1, 0.6 * cm))
    E.append(Paragraph(
        "Documento generado a partir del código y de los resultados del propio motor: "
        "<font face='DJM' size='7.5'>node scripts/guia-datos.mjs · python3 scripts/guia-figuras.py · "
        "python3 scripts/guia-pdf.py</font>",
        ParagraphStyle("FIN", parent=P, fontSize=7.8, textColor=MUTED, alignment=TA_CENTER)))


if __name__ == "__main__":
    portada()
    indice()
    cap1()
    cap2()
    cap3()
    cap4()
    cap5()
    cap6()
    cap7()
    cap9()
    cap10()
    cap11()
    cap12()
    cap13()
    cap14()
    cap15()
    Guia(PDF).build(E)
    print("escrito", PDF, f"({os.path.getsize(PDF) / 1024:.0f} kB)")
