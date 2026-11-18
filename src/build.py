# Rebuilds ../index.html from the sources in this folder: python3 build.py
import os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
t = open('template.html').read()
sim = open('sim.js').read().replace("if (typeof module !== 'undefined')", "if (typeof module !== 'undefined' && module.exports)")
game = open('p2p.js').read() + '\n' + open('game.js').read()
assert '</script' not in sim and '</script' not in game
out = t.replace('/*META*/', open('meta.json').read()).replace('/*SIM*/', sim).replace('/*GAME*/', game)
open('../index.html', 'w').write(out)
print(len(out))
