export = function(annotateResult) {
    
    const textAnnotations = annotateResult[0].textAnnotations;

    const failures = [];

    // textAnnotations 검사
    try {
        textAnnotationsInspector(textAnnotations);
    } catch (error) {
        failures.push(error.stack);
    }

    // fullTextAnnotation 검사하며 fullTextAnnotationPlusStudy 만들기
    // fullTextAnnotationPlusStudy 은 pages, blocks, paragraphs, words, symbols 각각이 하위요소의 text 내용을 전부 합친 문자열을 text(Study) 로 가진다.
    let fullTextAnnotationPlusStudy = null
    try {
        fullTextAnnotationPlusStudy = fullTextAnnotationInspector(annotateResult[0].fullTextAnnotation);
    } catch (error) {
        failures.push(error.stack);
    }

    return {textAnnotations, fullTextAnnotationPlusStudy, failures};
};

/**
 * textAnnotations 예외 찾기.
 * 가정 검증 & 분석도구역할.
 */
function textAnnotationsInspector(textAnnotations) {
    let result = []
    textAnnotations.forEach((textAnno, idx) => {
        if (
            textAnno.locations.length !== 0 ||
            textAnno.properties.length !== 0 ||
            textAnno.mid !== "" ||
            (textAnno.locale !== "" && idx !== 0) ||
            textAnno.score !== 0 ||
            textAnno.confidence !== 0 ||
            textAnno.topicality !== 0 ||
            textAnno.boundingPoly.normalizedVertices.length !== 0
        ) {
            result.push({textAnno, idx})
        }
    })
    if (result.length === 0) {
        // console.log("textAnnotations 예외 없음")
    }
    else {
        console.log("textAnnotations 예외 발견")
        console.log(result)
    };
};

/**
 * fullTextAnnotation 예외 찾기.
 * 가정 검증 & 분석도구역할.
 * fullTextAnnotationPlusStudy 를 만들어 반환해야함.
 */
function fullTextAnnotationInspector(fullTextAnnotation) {
    let fullTextAnnotationPlusStudy = fullTextAnnotation;
    let result = [];
    fullTextAnnotation.pages.forEach((page, pageIdx) => {
        if (page.property.detectedBreak !== null) {
            const exceptionPage = page
            delete exceptionPage.blocks
            result.push({exceptionPage, pageIdx})
            console.log(`page 예외 발견, ${pageIdx}`)
        };
        let pageText = ""
        page.blocks.forEach((block, blockIdx) => {
            if (
                block.property !== null ||
                block.boundingBox.normalizedVertices.length !== 0 ||
                block.blockType !== "TEXT"
            ) {
                const exceptionBlock = block
                delete exceptionBlock.paragraphs
                result.push({exceptionBlock, pageIdx, blockIdx})
                console.log(`block 예외 발견, ${pageIdx}, ${blockIdx}`)
            };
            let blockText = ""
            block.paragraphs.forEach((paragraph, paragraphIdx) => {
                if (
                    paragraph.property !== null ||
                    paragraph.boundingBox.normalizedVertices.length !== 0
                ) {
                    const exceptionParagraph = paragraph
                    delete exceptionParagraph.words
                    result.push({exceptionParagraph, pageIdx, blockIdx, paragraphIdx})
                    console.log(`paragraph 예외 발견, ${pageIdx}, ${blockIdx}, ${paragraphIdx}`)
                };
                let paragraphText = ""
                paragraph.words.forEach((word, wordIdx) => {
                    if (word.property === null) {} // 숫자일것이다
                    else {
                        if (
                            word.property.detectedLanguages[0].confidence !== 1 || // 배열순회하도록수정필요
                            word.property.detectedBreak !== null ||
                            word.boundingBox.normalizedVertices.length !== 0
                        ) {
                            const exceptionWord = word
                            delete exceptionWord.symbols
                            result.push({exceptionWord, pageIdx, blockIdx, paragraphIdx, wordIdx})
                            console.log(`word 예외 발견, ${pageIdx}, ${blockIdx}, ${paragraphIdx}, ${wordIdx}`)
                        };
                    };
                    let wordText = ""
                    word.symbols.forEach((symbol, symbolIdx) => {
                        if (symbol.property !== null) {
                            if (
                                (
                                    symbol.property.detectedBreak.type !== "SPACE" &&
                                    symbol.property.detectedBreak.type !== "EOL_SURE_SPACE" &&
                                    symbol.property.detectedBreak.type !== "LINE_BREAK"
                                ) ||
                                symbol.property.detectedLanguages.length !== 0 ||
                                symbol.property.detectedBreak.isPrefix !== false
                            ) {
                                const exceptionSymbol = symbol
                                result.push({exceptionSymbol, pageIdx, blockIdx, paragraphIdx, wordIdx, symbolIdx})
                                console.log(`symbol 예외 발견, ${pageIdx}, ${blockIdx}, ${paragraphIdx}, ${wordIdx}, ${symbolIdx}`)
                            };
                        };
                        wordText += symbol.text
                        if (symbol.property !== null) {
                            if (symbol.property.detectedBreak.type === "SPACE") {
                                wordText += " "
                                // console.log(wordText)
                            }
                            else if (symbol.property.detectedBreak.type === "EOL_SURE_SPACE") {
                                wordText += "\n"
                                // console.log(wordText)
                            }
                            else if (symbol.property.detectedBreak.type === "LINE_BREAK") {
                                wordText += "\n"
                                // console.log(wordText)
                            }
                        }
                    });
                    // fullTextAnnotationPlusStudy.pages[pageIdx].blocks[blockIdx].paragraphs[paragraphIdx].words[wordIdx].study = {}
                    // fullTextAnnotationPlusStudy.pages[pageIdx].blocks[blockIdx].paragraphs[paragraphIdx].words[wordIdx].study.text = wordText
                    fullTextAnnotationPlusStudy.pages[pageIdx].blocks[blockIdx].paragraphs[paragraphIdx].words[wordIdx].text = wordText
                    paragraphText += wordText
                });
                // fullTextAnnotationPlusStudy.pages[pageIdx].blocks[blockIdx].paragraphs[paragraphIdx].study = {}
                // fullTextAnnotationPlusStudy.pages[pageIdx].blocks[blockIdx].paragraphs[paragraphIdx].study.text = paragraphText
                fullTextAnnotationPlusStudy.pages[pageIdx].blocks[blockIdx].paragraphs[paragraphIdx].text = paragraphText
                blockText += paragraphText
            });
            // fullTextAnnotationPlusStudy.pages[pageIdx].blocks[blockIdx].study = {}
            // fullTextAnnotationPlusStudy.pages[pageIdx].blocks[blockIdx].study.text = blockText
            fullTextAnnotationPlusStudy.pages[pageIdx].blocks[blockIdx].text = blockText
            pageText += blockText
        });
        // fullTextAnnotationPlusStudy.pages[pageIdx].study = {}
        // fullTextAnnotationPlusStudy.pages[pageIdx].study.text = pageText
        fullTextAnnotationPlusStudy.pages[pageIdx].text = pageText
    });
    if (result.length === 0) {
        // console.log("fullTextAnnotation 예외 없음")
    } else {
        console.log("fullTextAnnotation 예외 발견")
        console.log(result)
    }
    return fullTextAnnotationPlusStudy;
};
