import test from 'node:test';
import assert from 'node:assert/strict';
import {notionNeedsReview,notionMarkdown} from '../workers/publisher/src/notion-import.mjs';

const paragraph=(text,extra={})=>({type:'paragraph',paragraph:{rich_text:[{plain_text:text,...extra}]}});
test('plain Notion paragraphs stay review-free',()=>{
 assert.equal(notionNeedsReview([paragraph('Xin chào')]),false);
 assert.equal(notionMarkdown([paragraph('Xin chào')]),'Xin chào');
});
test('rich Notion formatting and links require editorial review before import',()=>{
 assert.equal(notionNeedsReview([paragraph('Bold',{annotations:{bold:true}})]),true);
 assert.equal(notionNeedsReview([paragraph('Link',{href:'https://example.org'})]),true);
});
test('nested or unhandled blocks require review',()=>{
 assert.equal(notionNeedsReview([{...paragraph('Parent'),has_children:true}]),true);
 assert.equal(notionNeedsReview([{type:'image',image:{}}]),true);
 assert.equal(notionNeedsReview([{type:'quote',quote:{rich_text:[{plain_text:'Q'}]}}]),true);
});
