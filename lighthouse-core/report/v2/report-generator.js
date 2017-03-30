/**
 * @license
 * Copyright 2017 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const REPORT_TEMPLATE = fs.readFileSync(path.join(__dirname, './report-template.html'), 'utf8');
// TODO: Setup a gulp pipeline to concat and minify the renderer files?
const REPORT_JAVASCRIPT = fs.readFileSync(path.join(__dirname, './report-renderer.js'), 'utf8');

class ReportGeneratorV2 {
  /**
   * Computes the weighted-average of the score of the list of items.
   * @param {!Array<{score: number|undefined, weight: number|undefined}} items
   * @return {number}
   */
  static arithmeticMean(items) {
    const results = items.reduce((result, item) => {
      const score = Number(item.score) || 0;
      const weight = Number(item.weight) || 0;
      return {
        weight: result.weight + weight,
        sum: result.sum + score * weight,
      };
    }, {weight: 0, sum: 0});

    return (results.sum / results.weight) || 0;
  }

  /**
   * Returns the report JSON object with computed scores.
   * @param {{categories: !Object<{audits: !Array}>}} config
   * @param {!Object<{score: ?number|boolean|undefined}>} resultsByAuditId
   * @return {{categories: !Array<{audits: !Array<{score: number, result: !Object}>}>}}
   */
  generateReportJson(config, resultsByAuditId) {
    const categories = Object.keys(config.categories).map(categoryId => {
      const category = config.categories[categoryId];

      const audits = category.audits.map(audit => {
        const result = resultsByAuditId[audit.id];
        // Cast to number to catch `null` and undefined when audits error
        let score = Number(result.score) || 0;
        if (typeof result.score === 'boolean') {
          score = result.score ? 100 : 0;
        }

        return Object.assign({}, audit, {result, score});
      });

      const score = ReportGeneratorV2.arithmeticMean(audits);
      return Object.assign({}, category, {audits, score});
    });

    const score = ReportGeneratorV2.arithmeticMean(categories);
    return {score, categories};
  }

  /**
   * Returns the report HTML as a string with the report JSON and renderer JS inlined.
   * @param {!Object} reportAsJson
   * @return {string}
   */
  generateReportHtml(reportAsJson) {
    const sanitizedJson = JSON.stringify(reportAsJson).replace(/</g, '\\u003c');
    const sanitizedJavascript = REPORT_JAVASCRIPT.replace(/<\//g, '\\u003c/');
    return REPORT_TEMPLATE
      .replace(/%%LIGHTHOUSE_JSON%%/, sanitizedJson)
      .replace(/%%LIGHTHOUSE_JAVASCRIPT%%/, sanitizedJavascript);
  }
}

module.exports = ReportGeneratorV2;