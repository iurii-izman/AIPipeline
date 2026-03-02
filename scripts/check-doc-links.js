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
    let i = 0;
    while (i < line.length && line[i] === '#') i += 1;
    if (i < 1 || i > 6) continue;
    if (line[i] !== ' ') continue;
    const title = line.slice(i + 1).trim();
    if (!title) continue;
    anchors.add(githubSlug(title));
  }
  return anchors;
}

function extractMarkdownLinks(text) {
  const links = [];
  let i = 0;
  while (i < text.length) {
    const openLabel = text.indexOf('[', i);
    if (openLabel === -1) break;
    const closeLabel = text.indexOf(']', openLabel + 1);
    if (closeLabel === -1) break;
    if (text[closeLabel + 1] !== '(') {
      i = closeLabel + 1;
      continue;
    }
    const closeTarget = text.indexOf(')', closeLabel + 2);
    if (closeTarget === -1) break;
    const target = text.slice(closeLabel + 2, closeTarget);
    if (target) links.push(target);
    i = closeTarget + 1;
  }
  return links;
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
  for (const rawTarget of extractMarkdownLinks(text)) {
    let target = rawTarget.trim();
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
