#!/usr/bin/env python3
"""Figuras de la guia (docs/guia.pdf) a partir de docs/guia-datos.json.

Todos los numeros salen del motor de la app (scripts/guia-datos.mjs); aqui solo
se dibujan.  Paleta categorica validada (azul / naranja / aqua / violeta) con
etiquetas directas, rampa secuencial de un solo tono para las magnitudes y rampa
divergente de dos tonos con gris neutro en el centro para el laplaciano.
"""
import json
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import matplotlib.patheffects as pe
from matplotlib.colors import LinearSegmentedColormap, TwoSlopeNorm

# --- parametros de estilo ---------------------------------------------------
S1, S2, S3, S4 = "#2a78d6", "#eb6834", "#1baf7a", "#4a3aa7"   # categorica
INK, INK2, MUTED = "#0b0b0b", "#52514e", "#8a8880"
SURF = "#fcfcfb"
GRID = "#e4e3de"

SEQ = LinearSegmentedColormap.from_list("seq", ["#f4f8fd", "#cfe0f5", "#8fbaea", "#4a90dc", "#1f5aa3", "#0d2f57"])
DIV = LinearSegmentedColormap.from_list("div", ["#8c3410", "#eb6834", "#f5b79c", "#eceae4", "#a9c8ee", "#2a78d6", "#12385f"])

plt.rcParams.update({
    "font.family": "DejaVu Sans",
    "font.size": 8.5,
    "axes.edgecolor": "#c9c8c2",
    "axes.labelcolor": INK2,
    "axes.titlesize": 9.5,
    "axes.titleweight": "bold",
    "axes.titlecolor": INK,
    "axes.linewidth": 0.8,
    "xtick.color": MUTED,
    "ytick.color": MUTED,
    "xtick.labelsize": 7.5,
    "ytick.labelsize": 7.5,
    "legend.frameon": False,
    "legend.fontsize": 7.5,
    "figure.facecolor": SURF,
    "axes.facecolor": SURF,
    "savefig.facecolor": SURF,
    "lines.linewidth": 1.8,
    "lines.solid_capstyle": "round",
})

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "figs")
os.makedirs(OUT, exist_ok=True)
D = json.load(open(os.path.join(ROOT, "docs", "guia-datos.json")))


SUB = str.maketrans("0123456789+-", "₀₁₂₃₄₅₆₇₈₉⁺⁻")


def qf(key):
    """H2O -> H₂O,  C2H4 -> C₂H₄,  NH4+ -> NH₄⁺  (para títulos y tablas)."""
    out = []
    for ch in key:
        out.append(ch.translate(SUB) if ch.isdigit() or ch in "+-" else ch)
    return "".join(out)


def grid(ax, axis="both"):
    ax.grid(True, axis=axis, color=GRID, linewidth=0.7)
    ax.set_axisbelow(True)
    for s in ("top", "right"):
        ax.spines[s].set_visible(False)


def save(fig, name):
    path = os.path.join(OUT, name)
    fig.savefig(path, dpi=200, bbox_inches="tight", pad_inches=0.06)
    plt.close(fig)
    print("   ", name)
    return path


# --- 1. hidrogeno -----------------------------------------------------------
def fig_hidrogeno():
    d = D["hidrogeno"]
    r = np.array(d["r"])
    fig, axes = plt.subplots(1, 2, figsize=(7.4, 2.9))
    cols = [S1, S2, S3, S4, "#e34948"]
    for ax, key, ttl, ylab in (
        (axes[0], "R", "Parte radial $R_{n\\ell}(r)$", "R (u.a.)"),
        (axes[1], "D", "Distribución radial $r^2|R|^2$", "probabilidad por bohr"),
    ):
        for c, col in zip(d["curvas"], cols):
            y = np.array(c[key])
            m = r <= (8 if key == "R" else 22)
            ax.plot(r[m], y[m], color=col, label=c["label"])
            # etiqueta directa en el maximo de la curva
            i = int(np.argmax(np.abs(y[m])))
            ax.annotate(c["label"], (r[m][i], y[m][i]), textcoords="offset points",
                        xytext=(3, 3), color=col, fontsize=7.5, fontweight="bold")
        ax.axhline(0, color=MUTED, linewidth=0.7)
        ax.set_title(ttl)
        ax.set_xlabel("r (bohr)")
        ax.set_ylabel(ylab)
        grid(ax)
    return save(fig, "fig-hidrogeno.png")


# --- 2. ajuste STO-nG -------------------------------------------------------
def fig_stong():
    d = D["stong"]
    r = np.array(d["r"])
    fig, axes = plt.subplots(1, 2, figsize=(7.4, 2.9))
    cols = {1: S4, 2: S3, 3: S2, 6: S1}
    for ax, xmax, ttl in ((axes[0], 4.0, "Orbital de Slater 1s y sus ajustes"),
                          (axes[1], 0.6, "Cerca del núcleo: la cúspide que falta")):
        m = r <= xmax
        ax.plot(r[m], np.array(d["exacta"])[m], color=INK, linewidth=2.2, label="STO exacto  e$^{-r}$")
        for a in d["ajustes"]:
            ax.plot(r[m], np.array(a["y"])[m], color=cols[a["nG"]], linewidth=1.5,
                    linestyle="--" if a["nG"] < 3 else "-", label=f"STO-{a['nG']}G")
        ax.set_title(ttl)
        ax.set_xlabel("r (bohr)")
        ax.set_ylabel("función radial")
        grid(ax)
    axes[0].legend(loc="upper right")
    axes[1].annotate("la gaussiana llega con\npendiente nula: no hay cúspide",
                     xy=(0.02, 0.985), xytext=(0.22, 0.80), fontsize=7,
                     color=INK2, arrowprops=dict(arrowstyle="->", color=MUTED, lw=0.8))
    return save(fig, "fig-stong.png")


# --- 3. teorema variacional (helio) ----------------------------------------
def fig_variacional():
    d = D["helio"]
    z = np.array([p["zeta"] for p in d["curva"]])
    e = np.array([p["E"] for p in d["curva"]])
    fig, ax = plt.subplots(figsize=(4.6, 3.0))
    ax.plot(z, e, color=S1, marker="o", markersize=3.5, markerfacecolor=SURF,
            markeredgecolor=S1, markeredgewidth=1.2)
    ax.axvline(d["teorico"], color=S2, linewidth=1.4, linestyle="--")
    ax.annotate(f"ζ = 27/16 = {d['teorico']:.4f}", (d["teorico"], max(e)),
                textcoords="offset points", xytext=(6, -6), color=S2, fontsize=7.5, fontweight="bold")
    ax.plot([d["mejor"]["zeta"]], [d["mejor"]["E"]], marker="o", markersize=6,
            color=S2, markeredgecolor=SURF, markeredgewidth=1.4, zorder=5)
    ax.annotate(f"mínimo: ζ = {d['mejor']['zeta']:.4f}\nE = {d['mejor']['E']:.4f} Eh",
                (d["mejor"]["zeta"], d["mejor"]["E"]), textcoords="offset points",
                xytext=(8, 14), fontsize=7.5, color=INK2)
    ax.axhline(d["hf"], color=MUTED, linewidth=1.0, linestyle=":")
    ax.annotate("límite Hartree-Fock", (z[0], d["hf"]), textcoords="offset points",
                xytext=(2, 3), fontsize=7, color=MUTED)
    ax.set_title("Helio: energía frente al exponente ζ")
    ax.set_xlabel("ζ (exponente de la base)")
    ax.set_ylabel("E (hartree)")
    grid(ax)
    return save(fig, "fig-variacional.png")


# --- 4. convergencia del SCF ------------------------------------------------
def fig_scf():
    d = D["scf"]
    it = [h["iter"] for h in d["history"]]
    E = np.array([h["E"] for h in d["history"]])
    err = np.array([h["err"] for h in d["history"]])
    fig, axes = plt.subplots(1, 2, figsize=(7.4, 2.8))
    axes[0].plot(it, E, color=S1, marker="o", markersize=3.5, markerfacecolor=SURF,
                 markeredgecolor=S1, markeredgewidth=1.2)
    axes[0].axhline(d["Etot"], color=MUTED, linestyle=":", linewidth=1.0)
    axes[0].annotate(f"E final = {d['Etot']:.5f} Eh", (it[-1], d["Etot"]),
                     textcoords="offset points", xytext=(-4, 8), ha="right", fontsize=7.5, color=INK2)
    axes[0].set_title("Energía en cada ciclo (H₂O)")
    axes[0].set_ylabel("E total (hartree)")
    axes[1].semilogy(it, np.maximum(err, 1e-12), color=S2, marker="o", markersize=3.5,
                     markerfacecolor=SURF, markeredgecolor=S2, markeredgewidth=1.2)
    axes[1].axhline(1e-6, color=MUTED, linestyle=":", linewidth=1.0)
    axes[1].annotate("criterio de convergencia", (it[0], 1e-6), textcoords="offset points",
                     xytext=(2, 4), fontsize=7, color=MUTED)
    axes[1].set_title("Gradiente ‖FPS − SPF‖ (escala log)")
    axes[1].set_ylabel("error")
    for ax in axes:
        ax.set_xlabel("iteración")
        grid(ax)
    return save(fig, "fig-scf.png")


# --- 5. curvas E(R) ---------------------------------------------------------
def fig_er():
    fig, axes = plt.subplots(1, 2, figsize=(7.4, 2.9))
    for ax, d, col in zip(axes, D["er"], (S1, S3)):
        R = np.array([p["R"] for p in d["points"]])
        E = np.array([p["E"] for p in d["points"]])
        ax.plot(R, E, color=col, marker="o", markersize=3, markerfacecolor=SURF,
                markeredgecolor=col, markeredgewidth=1.1)
        ax.axvline(d["Rexp"], color=MUTED, linestyle=":", linewidth=1.0)
        ax.annotate(f"R exp. = {d['Rexp']:.3f} Å", (d["Rexp"], E.max()),
                    textcoords="offset points", xytext=(4, -8), fontsize=7, color=MUTED)
        ax.plot([d["Req"]], [d["Emin"]], marker="o", markersize=6, color=S2,
                markeredgecolor=SURF, markeredgewidth=1.4, zorder=5)
        ax.annotate(f"R$_e$ = {d['Req']:.3f} Å\nD$_e$ = {d['De'] * 27.2114:.2f} eV",
                    (0.97, 0.06), xycoords="axes fraction", ha="right", va="bottom",
                    fontsize=7.5, color=INK2,
                    bbox=dict(boxstyle="round,pad=0.3", facecolor="#ffffff",
                              edgecolor=GRID, linewidth=0.7))
        ax.set_title(f"Curva de energía potencial · {qf(d['key'])}")
        ax.set_xlabel("R (Å)")
        ax.set_ylabel("E total (hartree)")
        grid(ax)
    return save(fig, "fig-er.png")


# --- 6. niveles de orbitales moleculares -----------------------------------
def fig_om():
    """Diagrama de niveles. Se dibuja solo la VALENCIA: los 1s de core caen a
    −15 / −20 hartree y, si se incluyen, aplastan todo lo demás en una franja."""
    fig, axes = plt.subplots(1, 2, figsize=(7.4, 3.8))
    for ax, d in zip(axes, D["niveles"]):
        idx = [i for i, e in enumerate(d["eps"][:10]) if e > -5.0]
        core = [(i, e) for i, e in enumerate(d["eps"][:10]) if e <= -5.0]
        eps = [d["eps"][i] for i in idx]
        occ = [d["occ"][i] for i in idx]
        lo, hi = min(eps), max(eps)
        span = hi - lo
        ax.set_ylim(lo - 0.18 * span, hi + 0.18 * span)
        # separacion minima entre etiquetas, en unidades de energia
        sep = 0.075 * span
        ypos = []
        for e in eps:
            ypos.append(e if not ypos else max(e, ypos[-1] + sep))
        for i, (e, o, y) in enumerate(zip(eps, occ, ypos)):
            col = S1 if o > 0 else MUTED
            ax.hlines(e, 0.10, 0.78, color=col, linewidth=2.6)
            etiqueta = (d["comp"][idx[i]][:22].rstrip(" +") + ("…" if len(d["comp"][idx[i]]) > 22 else "")) if idx[i] < len(d["comp"]) else ""
            marca = ""
            if idx[i] == d["homo"]:
                marca = "  ← HOMO"
            elif idx[i] == d["homo"] + 1:
                marca = "  ← LUMO"
            ax.annotate(f"{idx[i] + 1}. {etiqueta}{marca}", (0.86, y), fontsize=6.6,
                        color=INK2 if o > 0 else MUTED, va="center")
            if abs(y - e) > 1e-9:
                ax.plot([0.78, 0.85], [e, y], color=GRID, linewidth=0.7)
            if o > 0:
                for k in range(int(round(o))):
                    ax.plot([0.34 + 0.18 * k], [e], marker="^" if k == 0 else "v",
                            markersize=3.6, color=SURF, markeredgecolor=S1, markeredgewidth=1.0)
        ax.set_xlim(0, 2.15)
        ax.set_ylabel("ε (hartree)")
        ax.set_xticks([])
        ax.set_title(f"Orbitales de valencia · {qf(d['key'])}")
        ax.spines["bottom"].set_visible(False)
        grid(ax, axis="y")
        if core:
            txt = ", ".join(f"nº {i + 1} a {e:.1f} Eh" for i, e in core)
            ax.annotate(f"capa interna fuera de escala: {txt}", (0.02, 0.02),
                        xycoords="axes fraction", fontsize=6.4, color=MUTED)
    fig.text(0.5, -0.01, "azul: ocupados (con sus electrones, ▲▼)   ·   gris: virtuales", ha="center",
             fontsize=7.5, color=MUTED)
    return save(fig, "fig-om.png")


# --- 7. perfiles a lo largo del enlace --------------------------------------
def fig_perfil():
    caja = dict(boxstyle="round,pad=0.28", facecolor="#ffffff", edgecolor=GRID, linewidth=0.7)
    fig, axes = plt.subplots(2, 2, figsize=(7.4, 4.8), sharex="col")
    for c, d in enumerate(D["perfiles"]):
        s = np.array([p["s"] for p in d["pts"]])
        rho = np.array([p["rho"] for p in d["pts"]])
        lap = np.array([p["lap"] for p in d["pts"]])
        a0, a1 = axes[0][c], axes[1][c]
        a0.plot(s, rho, color=S1)
        a0.set_yscale("log")
        a0.set_title(f"{qf(d['key'])} · densidad a lo largo del enlace")
        a0.set_ylabel("ρ (e/bohr³)")
        a1.plot(s, lap, color=S2)
        a1.axhline(0, color=MUTED, linewidth=0.8)
        # El laplaciano se desploma a ~ −10⁵ sobre los núcleos y aplastaria la
        # zona del enlace, que es justo la interesante: se recorta la escala.
        m = (s > 0.35 * d["d"]) & (s < 0.65 * d["d"])
        v = max(2.0, 3.5 * np.max(np.abs(lap[m]))) if m.any() else 4.0
        a1.set_ylim(-v, v)
        a1.set_ylabel("∇²ρ  (escala recortada)")
        a1.set_xlabel(f"distancia desde {d['syms'][0]} (bohr)")
        for ax in (a0, a1):
            for x in (0.0, d["d"]):
                ax.axvline(x, color=GRID, linewidth=1.4)
            grid(ax)
        if d["bcp"]:
            b = d["bcp"]
            for ax in (a0, a1):
                ax.axvline(b["s"], color=S4, linestyle="--", linewidth=1.2)
            a0.annotate(f"punto crítico de enlace\nρ$_b$ = {b['rho']:.3f}",
                        (0.5, 0.42), xycoords="axes fraction", ha="center", va="center",
                        fontsize=7, color=S4, bbox=caja)
            a1.annotate(f"∇²ρ = {b['lap']:+.3f} → {'concentración' if b['lap'] < 0 else 'deplexión'}\n"
                        f"{'enlace compartido (covalente)' if b['lap'] < 0 else 'capa cerrada (iónico)'}",
                        (0.5, 0.14), xycoords="axes fraction", ha="center",
                        fontsize=7, color=S4, bbox=caja)
        for x, sym in ((0.0, d["syms"][0]), (d["d"], d["syms"][1])):
            a0.annotate(sym, (x, 0.97), xycoords=("data", "axes fraction"),
                        textcoords="offset points", xytext=(3, -2), va="top",
                        fontsize=8.5, fontweight="bold", color=INK)
    return save(fig, "fig-perfil.png")


# --- 8/10. mapas 2D del plano molecular -------------------------------------
CP_STYLE = {
    "NCP": dict(marker="o", color=INK, size=26, label="núcleo (3,−3)"),
    "BCP": dict(marker="o", color=S2, size=26, label="enlace (3,−1)"),
    "RCP": dict(marker="s", color=S3, size=24, label="anillo (3,+1)"),
    "CCP": dict(marker="D", color=S4, size=22, label="caja (3,+3)"),
}


def _mapa_rho(ax, m, titulo):
    L, N = m["L"], m["N"]
    x = np.linspace(-L, L, N)
    Z = np.array(m["rho"])
    niveles = [0.002, 0.004, 0.008, 0.02, 0.04, 0.08, 0.2, 0.4, 0.8, 2.0]
    ax.contourf(x, x, Z, levels=[0] + niveles + [1e9], cmap=SEQ, norm=matplotlib.colors.LogNorm(vmin=1e-3, vmax=3))
    ax.contour(x, x, Z, levels=niveles, colors="#ffffff", linewidths=0.5, alpha=0.55)
    for p in m["paths"]:
        p = np.array(p)
        ax.plot(p[:, 0], p[:, 1], color="#ffffff", linewidth=2.6, solid_capstyle="round", zorder=4)
        ax.plot(p[:, 0], p[:, 1], color=S2, linewidth=1.3, solid_capstyle="round", zorder=5)
    vistos = set()
    for c in m["cps"]:
        st = CP_STYLE.get(c["type"])
        if not st:
            continue
        lab = st["label"] if st["label"] not in vistos else None
        vistos.add(st["label"])
        ax.scatter([c["u"]], [c["v"]], marker=st["marker"], s=st["size"], c=st["color"],
                   edgecolors="#ffffff", linewidths=1.1, zorder=6, label=lab)
    for a in m["atoms"]:
        ax.annotate(a["sym"], (a["u"], a["v"]), textcoords="offset points", xytext=(9, 7),
                    fontsize=9.5, fontweight="bold", color="#ffffff", zorder=7,
                    path_effects=[pe.withStroke(linewidth=2.2, foreground="#00000055")])
    ax.set_title(titulo)
    ax.set_xlabel("bohr")
    ax.set_ylabel("bohr")
    ax.set_aspect("equal")


def fig_mapa(key, nombre):
    m = next(x for x in D["mapas"] if x["key"] == key)
    fig, ax = plt.subplots(figsize=(5.1, 4.6))
    _mapa_rho(ax, m, f"{qf(key)}: densidad ρ(r), puntos críticos y caminos")
    ax.legend(loc="lower right", labelcolor=INK2, facecolor="#ffffffdd", frameon=True,
              framealpha=0.9, edgecolor="none")
    c = m["counts"]
    ax.annotate(f"Poincaré-Hopf:  n−b+r−c = {c['NCP']}−{c['BCP']}+{c['RCP']}−{c['CCP']} = {m['poincare']} ✓",
                (0.03, 0.03), xycoords="axes fraction", fontsize=7.2, color=INK2,
                bbox=dict(boxstyle="round,pad=0.3", facecolor="#ffffffdd", edgecolor="none"))
    return save(fig, nombre)


def fig_lap_elf():
    m = next(x for x in D["mapas"] if x["key"] == "H2O")
    L, N = m["L"], m["N"]
    x = np.linspace(-L, L, N)
    fig, axes = plt.subplots(1, 2, figsize=(7.4, 3.5))
    lap = -np.array(m["lap"])           # se dibuja −∇²ρ: positivo = carga concentrada
    v = 2.5
    im0 = axes[0].imshow(np.clip(lap, -v, v), extent=[-L, L, -L, L], origin="lower",
                         cmap=DIV, norm=TwoSlopeNorm(vmin=-v, vcenter=0, vmax=v))
    axes[0].contour(x, x, lap, levels=[0], colors=[INK], linewidths=0.6)
    axes[0].set_title("−∇²ρ: capas de concentración de carga")
    cb0 = fig.colorbar(im0, ax=axes[0], fraction=0.046, pad=0.03)
    cb0.outline.set_visible(False)
    im1 = axes[1].imshow(np.array(m["elf"]), extent=[-L, L, -L, L], origin="lower",
                         cmap=SEQ, vmin=0, vmax=1)
    axes[1].contour(x, x, np.array(m["elf"]), levels=[0.8], colors=["#ffffff"], linewidths=0.8)
    axes[1].set_title("ELF: pares enlazantes y solitarios")
    cb1 = fig.colorbar(im1, ax=axes[1], fraction=0.046, pad=0.03)
    cb1.outline.set_visible(False)
    for ax in axes:
        for a in m["atoms"]:
            ax.annotate(a["sym"], (a["u"], a["v"]), textcoords="offset points", xytext=(7, 6),
                        fontsize=9.5, fontweight="bold", color=INK,
                        path_effects=[pe.withStroke(linewidth=2.4, foreground="#ffffffcc")])
        ax.set_xlabel("bohr")
        ax.set_aspect("equal")
    axes[0].set_ylabel("bohr")
    ox = next(a for a in m["atoms"] if a["sym"] == "O")
    axes[1].annotate("par solitario", (ox["u"], ox["v"] - 1.6), xytext=(2.6, -3.6),
                     fontsize=7.2, color=INK2,
                     arrowprops=dict(arrowstyle="->", color=INK2, lw=0.9))
    axes[1].annotate("enlaces O–H", (ox["u"] + 1.6, ox["v"] + 1.6), xytext=(-4.4, 3.4),
                     fontsize=7.2, color=INK2,
                     arrowprops=dict(arrowstyle="->", color=INK2, lw=0.9))
    return save(fig, "fig-lap-elf.png")


# --- 11. validacion: fraccion del limite HF ---------------------------------
def fig_validacion():
    filas = [f for f in D["atomos"] if f["hf"]]
    syms = [f["sym"] for f in filas]
    xs = np.arange(len(filas))
    w = 0.26
    fig, ax = plt.subplots(figsize=(7.4, 2.9))
    for k, (clave, col, nombre) in enumerate((("sz", S4, "mínima (STO-3G)"),
                                              ("dz", S3, "doble ζ (STO-3G)"),
                                              ("dz4", S1, "doble ζ (STO-4G)"))):
        frac = [100 * f[clave] / f["hf"] for f in filas]
        ax.bar(xs + (k - 1) * w, frac, width=w * 0.92, color=col, label=nombre, zorder=3)
    ax.axhline(100, color=INK, linewidth=1.0, linestyle="--")
    ax.annotate("límite Hartree-Fock", (len(filas) - 0.4, 100), textcoords="offset points",
                xytext=(0, 4), ha="right", fontsize=7.5, color=INK)
    ax.set_ylim(90, 101.5)
    ax.set_xticks(xs)
    ax.set_xticklabels(syms)
    ax.set_ylabel("% de la energía HF capturada")
    ax.set_title("Cuánto del límite Hartree-Fock alcanza cada base")
    ax.legend(loc="lower left", ncol=3)
    grid(ax, axis="y")
    return save(fig, "fig-validacion.png")


# --- 15. leyenda de color: el mismo orbital de cuatro maneras ----------------
# Los colores son EXACTAMENTE los de la app (src/core/colormap.js):
POS = "#ff5a6e"   # psi > 0
NEG = "#4d8bff"   # psi < 0


def fig_leyenda():
    d = D["leyenda"]
    L = d["L"]
    psi = np.array(d["psi"])
    rho = np.array(d["rho"])
    nube = np.array(d["nube"])
    ext = [-L, L, -L, L]
    signo = LinearSegmentedColormap.from_list("signo", [NEG, "#eceae4", POS])
    magn = LinearSegmentedColormap.from_list("magn", ["#f4f8fd", "#8fbaea", "#1f5aa3", "#0d2f57"])

    fig, axes = plt.subplots(1, 4, figsize=(7.6, 2.6))
    v = np.max(np.abs(psi))

    axes[0].imshow(psi, extent=ext, origin="lower", cmap=signo,
                   norm=TwoSlopeNorm(vmin=-v, vcenter=0, vmax=v))
    axes[0].contour(np.linspace(-L, L, d["N"]), np.linspace(-L, L, d["N"]), psi,
                    levels=[0], colors=[INK], linewidths=0.8, linestyles="--")
    axes[0].set_title("ψ · por SIGNO")
    axes[0].annotate("ψ > 0", (0, 4.2), color="#7d1d2b", fontsize=7.5, ha="center", fontweight="bold")
    axes[0].annotate("ψ < 0", (0, -4.8), color="#173a6b", fontsize=7.5, ha="center", fontweight="bold")
    axes[0].set_xlabel("el signo de ψ: la línea de puntos\nes el plano nodal (ψ = 0)", fontsize=6.4,
                       color=INK2, linespacing=1.5)

    axes[1].imshow(rho, extent=ext, origin="lower", cmap=magn)
    axes[1].set_title("|ψ|² · por MAGNITUD")
    axes[1].set_xlabel("el signo ya no está:\n|ψ|² es siempre ≥ 0", fontsize=6.4, color=INK2,
                       linespacing=1.5)

    m = nube[:, 2] > 0
    axes[2].scatter(nube[m, 0], nube[m, 1], s=1.1, c=POS, linewidths=0)
    axes[2].scatter(nube[~m, 0], nube[~m, 1], s=1.1, c=NEG, linewidths=0)
    axes[2].set_xlim(-L, L)
    axes[2].set_ylim(-L, L)
    axes[2].set_title("nube de puntos")
    axes[2].set_xlabel("cada punto: un sitio donde\npodría estar el electrón", fontsize=6.4,
                       color=INK2, linespacing=1.5)

    axes[3].contour(np.linspace(-L, L, d["N"]), np.linspace(-L, L, d["N"]), psi,
                    levels=[-0.6 * v, -0.25 * v, -0.08 * v], colors=[NEG], linewidths=1.3)
    axes[3].contour(np.linspace(-L, L, d["N"]), np.linspace(-L, L, d["N"]), psi,
                    levels=[0.08 * v, 0.25 * v, 0.6 * v], colors=[POS], linewidths=1.3)
    axes[3].set_xlim(-L, L)
    axes[3].set_ylim(-L, L)
    axes[3].set_title("isosuperficie")
    axes[3].set_xlabel("cada curva = un valor fijo de ψ;\nel «nivel iso» elige cuál", fontsize=6.4,
                       color=INK2, linespacing=1.5)

    for ax in axes:
        ax.set_aspect("equal")
        ax.set_xticks([]); ax.set_yticks([])
        for s in ("top", "right", "bottom", "left"):
            ax.spines[s].set_color("#c9c8c2")
    return save(fig, "fig-leyenda.png")


# --- 16. marcadores de QTAIM ------------------------------------------------
def fig_marcadores():
    fig, ax = plt.subplots(figsize=(7.2, 2.6))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 40)
    ax.axis("off")
    items = [
        ("#ffffff", "núcleo  (3,−3)",
         "máximo de ρ: un átomo. Solo aparece\ncomo punto si ocultas los núcleos."),
        ("#ffd479", "enlace  (3,−1)",
         "punto de SILLA entre dos átomos\nenlazados. Lleva la etiqueta ρ = …"),
        ("#49e0a0", "anillo  (3,+1)",
         "silla en el centro de un ciclo\n(benceno, H₃⁺)."),
        ("#c08bff", "caja  (3,+3)",
         "mínimo de ρ dentro de una\ncavidad cerrada (cubano)."),
    ]
    for i, (col, tit, txt) in enumerate(items):
        x = 2 + (i % 2) * 50
        y = 33 - (i // 2) * 15
        ax.scatter([x + 1.6], [y], marker="o", s=95, c=col, edgecolors=INK2, linewidths=0.9, zorder=3)
        ax.text(x + 5, y, tit, fontsize=7.4, fontweight="bold", color=INK, va="center")
        ax.text(x + 5, y - 3.4, txt, fontsize=6.6, color=INK2, va="top", linespacing=1.5)
    ax.plot([4, 22], [4, 4], color="#ffd479", linewidth=2.4)
    ax.scatter([13], [4], s=80, c="#ffd479", edgecolors=INK2, linewidths=0.8, zorder=3)
    ax.scatter([4, 22], [4, 4], s=95, c="#ffffff", edgecolors=INK2, linewidths=0.8, zorder=3)
    ax.text(26, 4, "camino de enlace: la línea de máxima densidad que une dos núcleos\n"
                   "pasando por su punto crítico de enlace", fontsize=6.9, color=INK2, va="center",
            linespacing=1.5)
    return save(fig, "fig-marcadores.png")


# --- 13. el ciclo de Hartree-Fock -------------------------------------------
def fig_ciclo():
    fig, ax = plt.subplots(figsize=(7.0, 4.8))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 74)
    ax.axis("off")

    def caja(x, y, w, h, txt, col, fs=7.2, negrita=None):
        ax.add_patch(plt.Rectangle((x, y), w, h, facecolor="#ffffff", edgecolor=col,
                                   linewidth=1.4, zorder=2))
        if negrita:
            ax.text(x + w / 2, y + h - 3.4, negrita, ha="center", va="center",
                    fontsize=fs + 0.6, fontweight="bold", color=col, zorder=4)
            ax.text(x + w / 2, y + h / 2 - 2.6, txt, ha="center", va="center",
                    fontsize=fs, color=INK2, zorder=4, linespacing=1.5)
        else:
            ax.text(x + w / 2, y + h / 2, txt, ha="center", va="center",
                    fontsize=fs, color=INK2, zorder=4, linespacing=1.5)

    def flecha(x1, y1, x2, y2, txt="", rad=0.0, col=MUTED, dx=0, dy=1.8):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color=col, lw=1.3, shrinkA=3, shrinkB=3,
                                    connectionstyle=f"arc3,rad={rad}"))
        if txt:
            ax.text((x1 + x2) / 2 + dx, (y1 + y2) / 2 + dy, txt, ha="center",
                    fontsize=6.6, color=col)

    caja(1, 59, 31, 13, "núcleos fijos y base\n(Born-Oppenheimer)", S4, negrita="1 · el sistema")
    caja(37, 59, 26, 13, "S, T, V y (μν|λσ),\nuna sola vez", S4, negrita="2 · integrales")
    caja(68, 59, 31, 13, "densidad P de partida\n(aproximación GWH)", S4, negrita="3 · arranque")

    caja(28, 36, 46, 15, "F = H + J[P] − ½ K[P]\nJ = repulsión promedio   ·   K = intercambio", S1,
         negrita="4 · construir el operador de Fock")
    caja(28, 17, 46, 13, "F C = S C ε  →  orbitales nuevos,\ny con ellos una densidad P nueva", S1,
         negrita="5 · resolver")
    caja(1, 17, 22, 13, "¿|ΔE| y ‖FPS−SPF‖\nson pequeños?", S2, negrita="6 · ¿converge?")
    caja(1, 1, 22, 12, "energía, orbitales,\ndensidad, cargas", S3, negrita="resultados")

    flecha(32, 65.5, 37, 65.5)
    flecha(63, 65.5, 68, 65.5)
    flecha(83, 59, 60, 51, "P inicial", dx=7, dy=1)
    flecha(51, 36, 51, 30)
    flecha(28, 23.5, 23, 23.5, "P nueva", dy=1.6)
    flecha(12, 17, 12, 13, "sí", col=S3, dx=-2.6, dy=0)
    flecha(15, 30, 31, 40, "no: otra vuelta", rad=-0.3, col=S2, dx=3, dy=-4.5)
    ax.text(50, 8, "el operador de Fock depende de la solución que se busca:\npor eso no se resuelve, se ITERA",
            ha="center", fontsize=7.2, color=MUTED, style="italic", linespacing=1.5)
    return save(fig, "fig-hf-ciclo.png")


# --- 14. la escalera de la correlacion --------------------------------------
def fig_correlacion():
    EH = 27.211386
    datos = D["correlacion"]
    fig, axes = plt.subplots(1, len(datos), figsize=(7.4, 3.4))
    for ax, c in zip(axes, datos):
        # Todo medido como distancia POR ENCIMA de la energia exacta, en eV.
        niveles = [
            ("base mínima", (c["sz"] - c["exacta"]) * EH, S4),
            ("doble ζ (4G)", (c["dz4"] - c["exacta"]) * EH, S4),
            ("even-tempered", (c["et"] - c["exacta"]) * EH, S1),
            ("límite Hartree-Fock", (c["hf"] - c["exacta"]) * EH, INK),
            ("energía exacta", 0.0, S3),
        ]
        top = niveles[0][1]
        # Etiquetas separadas un minimo: even-tempered y el limite HF casi coinciden.
        sep = 0.075 * top
        ys = []
        for _, v, _ in sorted(niveles, key=lambda t: t[1]):
            ys.append(v if not ys else max(v, ys[-1] + sep))
        ypos = {round(v, 9): y for (_, v, _), y in zip(sorted(niveles, key=lambda t: t[1]), ys)}
        for lab, v, col in niveles:
            ax.hlines(v, 0.08, 0.72, color=col, linewidth=2.6)
            y = ypos[round(v, 9)]
            ax.annotate(f"{lab}", (0.78, y), fontsize=6.8, color=col, va="center")
            if abs(y - v) > 1e-9:
                ax.plot([0.72, 0.77], [v, y], color=GRID, linewidth=0.7)
        gap = niveles[3][1]
        ax.annotate("", xy=(0.05, 0), xytext=(0.05, gap),
                    arrowprops=dict(arrowstyle="<->", color=S2, lw=1.3))
        ax.annotate(f"correlación\n{gap:.2f} eV", (0.05, gap / 2), textcoords="offset points",
                    xytext=(4, 0), fontsize=6.8, color=S2, va="center", fontweight="bold")
        ax.set_xlim(0, 2.4)
        ax.set_ylim(-0.06 * top, 1.12 * top)
        ax.set_xticks([])
        ax.set_title(f"{c['sym']}  (Z = {c['Z']})")
        ax.set_ylabel("energía por encima de la exacta (eV)")
        ax.spines["bottom"].set_visible(False)
        grid(ax, axis="y")
    return save(fig, "fig-correlacion.png")


# --- 12. arquitectura -------------------------------------------------------
def fig_arquitectura():
    fig, ax = plt.subplots(figsize=(7.4, 4.4))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 66)
    ax.axis("off")

    def caja(x, y, w, h, titulo, cuerpo, col, fs=7.4):
        ax.add_patch(plt.Rectangle((x, y), w, h, facecolor="#ffffff", edgecolor=col,
                                   linewidth=1.4, zorder=2, joinstyle="round"))
        ax.add_patch(plt.Rectangle((x, y + h - 4.6), w, 4.6, facecolor=col, edgecolor=col,
                                   linewidth=1.4, zorder=3))
        ax.text(x + w / 2, y + h - 2.3, titulo, ha="center", va="center", fontsize=fs,
                fontweight="bold", color="#ffffff", zorder=4)
        ax.text(x + 1.8, y + h - 6.6, cuerpo, ha="left", va="top", fontsize=6.2,
                color=INK2, zorder=4, linespacing=1.45)

    def flecha(x1, y1, x2, y2, txt=""):
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="-|>", color=MUTED, lw=1.2,
                                    shrinkA=2, shrinkB=2, connectionstyle="arc3,rad=0"))
        if txt:
            ax.text((x1 + x2) / 2, (y1 + y2) / 2 + 1.2, txt, ha="center", fontsize=6.4, color=MUTED)

    caja(1, 36, 30, 28, "HILO PRINCIPAL (main.js)",
         "• estado de la app y panel de control\n"
         "• escena Three.js, cámara, WebXR\n"
         "• sonda, gráficas, textos del panel\n"
         "• física exacta (hidrógeno, caja,\n  híbridos, estructura fina)", S1)
    caja(69, 36, 30, 28, "HILO DE CÁLCULO (qcworker.js)",
         "• base y integrales moleculares\n"
         "• SCF (RHF / UHF)\n"
         "• campos 3D (OM, ρ, ∇²ρ, ELF)\n"
         "• topología QTAIM y cuencas\n"
         "• curvas E(R) y E(ζ)", S2, fs=6.6)
    caja(35, 41, 30, 18, "qcclient.js",
         "puente con promesas:\n  request(tipo, datos, onProgress)\n"
         "mensajes con id, progreso y\ntransferencia de buffers", S4)
    caja(1, 1, 46, 29, "src/physics/  (el motor)",
         "atoms.js  tabla periódica, reglas de Slater\n"
         "basis.js  STO-nG, hidrogenoides, even-tempered\n"
         "gto.js  integrales (McMurchie-Davidson, Boys)\n"
         "linalg.js  Jacobi, ortogonalización canónica\n"
         "scf.js  Hartree-Fock con DIIS\n"
         "qchem.js  sistema completo + poblaciones\n"
         "density.js  ρ, ∇ρ, hessiano, G, V, ELF\n"
         "qtaim.js  puntos críticos, caminos, cuencas", S3)
    caja(53, 1, 46, 29, "src/viz/ y src/core/  (lo que se ve)",
         "field3d.js  muestreo del campo en rejilla\n"
         "isosurface.js  marching cubes → malla\n"
         "pointcloud.js  nube de puntos por |ψ|²\n"
         "slices.js / probe.js  cortes y sonda\n"
         "molecule.js  núcleos, enlaces, CPs, cuencas\n"
         "charts.js  niveles OM y curvas E(R)/E(ζ)\n"
         "scene.js / xr.js  render, mandos, VR\n"
         "vrmenu.js  menú flotante dentro de las gafas", S4)

    flecha(31, 53, 35, 53)
    flecha(65, 53, 69, 53)
    ax.text(50, 59.5, "petición", ha="center", fontsize=6.4, color=MUTED)
    flecha(69, 46, 65, 46)
    flecha(35, 46, 31, 46)
    ax.text(50, 36.5, "resultado (buffers transferidos)", ha="center", fontsize=6.4, color=MUTED)
    flecha(84, 36, 84, 30.5)
    flecha(16, 36, 16, 30.5)
    ax.text(50, 32.5, "el cálculo pesado nunca bloquea el render: por eso la VR no da tirones",
            ha="center", fontsize=7, color=MUTED, style="italic")
    return save(fig, "fig-arquitectura.png")


if __name__ == "__main__":
    print("figuras:")
    fig_hidrogeno()
    fig_stong()
    fig_variacional()
    fig_scf()
    fig_er()
    fig_om()
    fig_perfil()
    fig_mapa("H2O", "fig-mapa-h2o.png")
    fig_mapa("C2H4", "fig-mapa-c2h4.png")
    fig_lap_elf()
    fig_validacion()
    fig_arquitectura()
    fig_ciclo()
    fig_correlacion()
    fig_leyenda()
    fig_marcadores()
    print("listo")
