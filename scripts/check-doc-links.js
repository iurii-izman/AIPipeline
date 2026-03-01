#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();
const inputs = ['README.md', 'docs'];
const markdownFiles = [];

function walk(p) {
  if (!fs.existsSync(p)) return;
  const st = fs.statSync(p);
  if (st.isFile() && p.endsWith('.md')) {
    markdownFiles.push(p);
    return;
  }
  if (!st.isDirectory()) return;
  for (const ent of fs.readdirSync(p, { withFileTypes: true })) {
    if (ent.name.startsWith('.')) continue;
    walk(path.join(p, ent.name));
  }
}

for (const p of inputs) walk(path.join(repoRoot, p));

const mdLinkRegex = /\[[^\]]+\]\(([^)]+)\)/g;
const errors = [];

function githubSlug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function collectAnchors(mdPath) {
  const txt = fs.readFileSync(mdPath, 'utf8');
  const anchors = new Set();
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^#{1,6}\s+(.+)$/);
    if (!m) continue;
    anchors.add(githubSlug(m[1]));
  }
  return anchors;
}

const anchorCache = new Map();
function getAnchors(mdPath) {
  if (!anchorCache.has(mdPath)) anchorCache.set(mdPath, collectAnchors(mdPath));
  return anchorCache.get(mdPath);
}

function addError(file, link, msg) {
  errors.push({ file: path.relative(repoRoot, file), link, msg });
}

for (const file of markdownFiles) {
  const text = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = mdLinkRegex.exec(text))) {
    let target = m[1].trim();
    if (!target) continue;
    target = target.split(/\s+/)[0];

    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('mailto:') || target.startsWith('tel:')) continue;

    if (target.startsWith('/var/home/user/Projects/AIPipeline/')) {
      addError(file, target, 'absolute local path is not allowed in docs; use repo-relative links');
      continue;
    }

    if (target.startsWith('#')) {
      const anchor = target.slice(1);
      const anchors = getAnchors(file);
      if (!anchors.has(anchor)) addError(file, target, 'missing local anchor');
      continue;
    }

    const [rawPath, rawAnchor] = target.split('#');
    if (!rawPath) continue;

    const resolved = path.isAbsolute(rawPath)
      ? path.normalize(path.join(repoRoot, rawPath))
      : path.normalize(path.join(path.dirname(file), rawPath));

    if (!fs.existsSync(resolved)) {
      addError(file, target, `missing target: ${path.relative(repoRoot, resolved)}`);
      continue;
    }

    if (rawAnchor && resolved.endsWith('.md')) {
      const anchors = getAnchors(resolved);
      if (!anchors.has(rawAnchor)) addError(file, target, `missing anchor in target: #${rawAnchor}`);
    }
  }
}

if (errors.length) {
  console.error('Documentation link check failed:');
  for (const e of errors) console.error(`- ${e.file}: ${e.link} -> ${e.msg}`);
  process.exit(1);
}

console.log(`Documentation link check passed (${markdownFiles.length} markdown files).`);
