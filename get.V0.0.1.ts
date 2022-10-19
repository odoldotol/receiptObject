// version 0.0.1

// 구굴 비젼 API 의 "TEXT_DETECTION", "DOCUMENT_TEXT_DETECTION" 기능을 포함한 annotateResult: [google.cloud.vision.v1.IAnnotateImageResponse] 로부터 데이터를 얻습니다.
// 인자 annotateResult 는 googleVisionAnnoPipe/inspector.V0.0.1 를 통해 검증되어야 합니다.
// Receipt Object Define Version = 0.0.1

// 영수증의 구조분석과 요소간 상대적 위치를 기준으로 텍스트요소들을 찾아내는 솔루션입니다.
// 홈플러스 단일 술루션입니다.

// 홈플러스 1번 영수증을 기반으로 시작했다.
/** 
 * 테스트영수증 커버리지
 * 
 * - 구매 목록 리스트
 * 홈플러스 1-7
 */

/** 제약적인 가정
 * 
 * 영수증은 전체가 보이게 하나의 사진으로 하나의 영수증만 전달되었음.
 * 영수증은 거의 수평으로 활영되었음.
 * 상품명 단가 수량 금액 요소간의 y축 거리는 어떠한 다른 요소들과의 y축 거리보다 가까움.
 * 상품명 단가 수량 금액 요소들 모두 구글 비젼API가 오타없이 정확히 찾아냈음 (비록 오답인 요소가 함께 찾아졌을지라도).
 * 위에서 언급한 오답인 요소는 정답요소와 완전한 수평위치에 있을 수 없음.
 * "표시 상품은 부가세 면세품목입니다" | "과세물품" 를 정확히 하나만 찾아냈음.
 */

/** 한계
 * 
 * taxExemption 은 기대를 하지 말자.
 * 홈플러스의 부가세 면세품목을 감지하기위해서는 * 를 똑바로 감지해야하는데 이에대한 정확도에 문제가 있음.
 * 우선 * 이나 . 로 찾는건 처리를 하지만 그외 이상하게 찾거나 못찾는것은 그대로 방치중임
 */

import { MultipartBodyDto } from 'src/receipt-to-sheet/dto/multipartBody.dto';
import {ReceiptItem, Discount, ItemReadFromReceipt, Receipt, Provider} from './define.V0.0.1';
/**
 * 
 */
export = function(annotateResult: {textAnnotations, fullTextAnnotationPlusStudy}, multipartBody: MultipartBodyDto) {
    
    const {textAnnotations, fullTextAnnotationPlusStudy} = annotateResult;

    // 영수증의 기울기나 상태에 따라 범위를 조절해야할 수도 있음. 일단은 고정솔루션으로 최대한 커버해보기
    /* const {
        productNameRangeX,
        unitPriceRangeX,
        quantityRangeX,
        amountRangeX,
        itemRangeY
    } = findItemRange(textAnnotations, fullTextAnnotationPlusStudy); */

    const { // 먼저 단가까지만 찾을준비
        productNameRangeX,
        unitPriceRangeX,
        itemRangeY,
        quantity,
        amount
    } = findItemRangeUntilUnitPrice(textAnnotations, fullTextAnnotationPlusStudy);

    // 상품명, 단가, 수량, 금액 요소들을 모아놓은 배열을 만들고 y축에대해 정렬.
    const productNameGroup = sortGroupAscByY(
        getFulltextAnnoObjByRange(
            fullTextAnnotationPlusStudy,
            productNameRangeX,
            itemRangeY,
            false
        )
    );
    const unitPriceGroup = sortGroupAscByY(
        getFulltextAnnoObjByRange(
            fullTextAnnotationPlusStudy,
            unitPriceRangeX,
            itemRangeY,
            false,
            {includeWords: true, word: 1}
        )
    );
    // const quantityGroup = sortGroupAscByY(
    //     getFulltextAnnoObjByRange(
    //         fullTextAnnotationPlusStudy,
    //         quantityRangeX,
    //         itemRangeY,
    //         false
    //     )
    // );

    const { // 수량, 금약 찾을 준비
        quantityRangeX,
        amountRangeX
    } = findItemRangeQuantityAmount(textAnnotations, quantity, amount, unitPriceGroup);

    const quantityGroup = sortGroupAscByY(
        getFulltextAnnoObjByRange(
            fullTextAnnotationPlusStudy,
            quantityRangeX,
            itemRangeY,
            true,
            {includeSymbols: false}
        )
    );
    // const amountGroup = sortGroupAscByY(
    //     getFulltextAnnoObjByRange(
    //         fullTextAnnotationPlusStudy,
    //         amountRangeX,
    //         itemRangeY,
    //         false,
    //         {includeWords: true, word: 1}
    //     )
    // );
    const amountGroup = sortGroupAscByY(
        getFulltextAnnoObjByRange(
            fullTextAnnotationPlusStudy,
            amountRangeX,
            itemRangeY,
            true,
            {includeSymbols: false}
        )
    );

    // console.log('productNameGroup', productNameGroup);
    // console.log('unitPriceGroup', unitPriceGroup);
    // console.log('quantityGroup', quantityGroup);
    // console.log('amountGroup', amountGroup);

    // 상품명, 단가, 수량, 금액 요소들의 텍스트들을 행열에 맞춰 모두 같은 길이의 배열로 만들기.
    const textArrays = getTextArraysFromGroups(
        productNameGroup,
        unitPriceGroup,
        quantityGroup,
        amountGroup
    );

    /* 다듬기
    상품명: 숫자 두개로 시작하면 숫자 두개 제거, 공백으로 시작하거나 공백으로 끝나면 공백 제거
    나머지: 공백으로 시작하거나 공백으로 끝나면 공백 제거, 쉼표+숫자+숫자+숫자 발견시 쉼표 제거(그냥 모든쉼표 제거로 대체+포인트(.)로잘못찾는것도 제거) */
    const productNameArr = deleteSpacesEachEleOfFrontAndBackInArr(
        deleteStartingTwoNumbersEachEleInArr(textArrays.productNameArray)
    );
    const unitPriceArr = deleteAllCommaEachEleInArr(
        deleteSpacesEachEleOfFrontAndBackInArr(textArrays.unitPriceArray)
    );
    const quantityArr = deleteAllCommaEachEleInArr(
        deleteSpacesEachEleOfFrontAndBackInArr(textArrays.quantityArray)
    );
    const amountArr = deleteAllCommaEachEleInArr(
        deleteSpacesEachEleOfFrontAndBackInArr(textArrays.amountArray)
    );

    const receiptItemArray = makeReceiptItemArray(productNameArr, unitPriceArr, quantityArr, amountArr);
    
    // text
    const receipt = new Receipt(new Provider(multipartBody.emailAddress), receiptItemArray);
    return receipt;
};

class idx { // 오직, 해석과 Dev편의성을 위한 놈
    constructor(
        public pageIdx: number,
        public blockIdx?: number,
        public paragraphIdx?: number,
        public wordIdx?: number,
        public symbolIdx?: number,
    ) {}
};

/**
 * #### 정규표현식과 일치하는 요소 찾기 
 */
function getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, reg) {
    let result = []
    if (reg.test(fullTextAnnotationPlusStudy.text)) {
        let isInPage = false
        fullTextAnnotationPlusStudy.pages.forEach((page, pageIndex) => {
            if (reg.test(page.text)) {
                isInPage = true
                let isInBlock = false
                page.blocks.forEach((block, blockIndex) => {
                    if (reg.test(block.text)) {
                        isInBlock = true
                        let isInParagraph = false
                        block.paragraphs.forEach((paragraph, paragraphIndex) => {
                            if (reg.test(paragraph.text)) {
                                isInParagraph = true
                                let isInWord = false
                                paragraph.words.forEach((word, wordIndex) => {
                                    if (reg.test(word.text)) {
                                        isInWord = true
                                        let isInSymbol = false
                                        word.symbols.forEach((symbol, symbolIndex) => {
                                            if (reg.test(symbol.text)) {
                                                isInSymbol = true
                                                result.push([new idx(pageIndex, blockIndex, paragraphIndex, wordIndex, symbolIndex), symbol])
                                            }
                                        })
                                        // 모든 심볼에서 없으면?
                                        if (!isInSymbol) {
                                            result.push([new idx(pageIndex, blockIndex, paragraphIndex, wordIndex), word])
                                        }
                                    }
                                })
                                // 모든 단어에서 없으면?
                                if (!isInWord) {
                                    result.push([new idx(pageIndex, blockIndex, paragraphIndex), paragraph])
                                }
                            }
                        })
                        // 모든 구절에서 없으면?
                        if (!isInParagraph) {
                            result.push([new idx(pageIndex, blockIndex), block])
                        }
                    }
                })
                // 모든 블록에서 없으면?
                if (!isInBlock) {
                    result.push([new idx(pageIndex), page])
                }
            }
        })
        // 모든 페이지에서 없으면?
        if (!isInPage) {
            return []
        }
    }
    else {
        return null
    }
    return result
};

/**
 * #### 영수증 위치해석 & 읽을 text 위치 결정
 * 
 * 1. 상품명 단가 수량 금액 라인 찾기.
 * 2. Item 하안선 기준요소 부분 찾기.
 * 3. 1,2 번에서 찾은걸로 y축 범위 결정하기.
 * 4. 상품명 단가 수량 금액들의 가로축 범위 결정하기.
 */
function findItemRange(textAnnotations, fullTextAnnotationPlusStudy) {

    // 1. 상품명 단가 수량 금액 라인 찾기
    const productName = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /상품명/)
    const unitPrice = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /단가/)
    const quantity = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /수량/)
    const amount = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /금액/)

    let productNameIndex: number;
    let unitPriceIndex: number;
    let quantityIndex: number;
    let amountIndex: number;

    let unitPriceAverageY: number;
    let quantityAverageY: number;
    
    // 상품명과 단가를 비교하여 세로축이 가장 인접한것 매칭
    let difference = 999;
    productName.forEach((productNameEle, productNameEleIdx) => {
        unitPrice.forEach((unitPriceEle, unitPriceEleIdx) => {
            const productNameEleAverageY = calAverageXorY(productNameEle, "y")
            const unitPriceEleAverageY = calAverageXorY(unitPriceEle, "y")
            const newDifference = Math.abs(productNameEleAverageY - unitPriceEleAverageY)
            if (newDifference < difference) {
                difference = newDifference
                productNameIndex = productNameEleIdx
                unitPriceIndex = unitPriceEleIdx
                unitPriceAverageY = unitPriceEleAverageY
            }
        })
    });

    // 단가를 기준으로 세로축방향으로 가장 인접한 수량 찾기
    difference = 999;
    quantity.forEach((quantityEle, quantityEleIdx) => {
        const quantityEleAverageY = calAverageXorY(quantityEle, "y")
        const newDifference = Math.abs(unitPriceAverageY - quantityEleAverageY)
        if (newDifference < difference) {
            difference = newDifference
            quantityIndex = quantityEleIdx
            quantityAverageY = quantityEleAverageY
        }
    });

    // 수량을 기준으로 세로축방향으로 가장 인접한 금액 찾기
    difference = 999;
    amount.forEach((amountEle, amountEleIdx) => {
        const amountEleAverageY = calAverageXorY(amountEle, "y")
        const newDifference = Math.abs(quantityAverageY - amountEleAverageY)
        if (newDifference < difference) {
            difference = newDifference
            amountIndex = amountEleIdx
        }
    });

    // 2. 아이템 y축 하안선 기준요소 찾기
    let itemYBottomPin = []
    const taxExemptionMsg = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /표시 상품은 부가세 면세품목입니다/)
    if (taxExemptionMsg === null) {
        const taxProductAmountMsg = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /과세물품/)
        itemYBottomPin = taxProductAmountMsg
    }
    else {
        itemYBottomPin = taxExemptionMsg
    }

    // 3. 1,2 번에서 찾은걸로 y축 범위 결정하기
    const productNameYs = getXorYArr(productName[productNameIndex], "y")
    const unitPriceYs = getXorYArr(unitPrice[unitPriceIndex], "y")
    const quantityYs = getXorYArr(quantity[quantityIndex], "y")
    const amountYs = getXorYArr(amount[amountIndex], "y")
    const minY = Math.max(...productNameYs, ...unitPriceYs, ...quantityYs, ...amountYs)
    // maxY 는 itemYBottomPin 의 y 값 중에서 2번째로 작은값 (대체적으로 수평인 다양한 기울기에서 이게 기하학적으로 제일 안전하다)
    const maxY = getXorYArr(itemYBottomPin[0], "y")
        .sort((a, b) => a - b)[1]

    // 4. 상품명 단가 수량 금액들의 가로축 범위 결정하기
    // const unitPriceAverageX = calAverageXorY(unitPrice[unitPriceIndex], "x")
    const unitPriceMaxX = Math.max(...getXorYArr(unitPrice[unitPriceIndex], "x"))
    const textAnnotationsMinX = Math.min(...getXorYArr(textAnnotations[0], "x", true))
    const textAnnotationsMaxX = Math.max(...getXorYArr(textAnnotations[0], "x", true))
    // const productNameRangeX = [textAnnotationsMinX,unitPriceAverageX]
    const productNameRangeX = [textAnnotationsMinX,unitPriceMaxX]
    const quantityMinX = Math.min(...getXorYArr(quantity[quantityIndex], "x"))
    const quantityAverageX = calAverageXorY(quantity[quantityIndex], "x")
    const unitPriceRangeX = [unitPriceMaxX,quantityMinX]
    const quantityMaxX = Math.max(...getXorYArr(quantity[quantityIndex], "x"))
    const amountMinX = Math.min(...getXorYArr(amount[amountIndex], "x"))
    // const quantityRangeX = [quantityMinX,(quantityMaxX+amountMinX)/2]
    const quantityRangeX = [quantityAverageX,(quantityMaxX+amountMinX)/2]
    // const amountMaxX = Math.max(...getXorYArr(amount[amountIndex], "x"))
    // const amountRangeX = [amountMinX,amountMaxX]
    const amountRangeX = [(quantityMaxX+amountMinX)/2,textAnnotationsMaxX]
    const itemRangeY = [minY,maxY]

    return {productNameRangeX, unitPriceRangeX, quantityRangeX, amountRangeX, itemRangeY}
};

/**
 * #### 영수증 위치해석 & 읽을 text 위치 결정 // 단가까지만
 * 
 * 1. 상품명 단가 수량 금액 라인 찾기.
 * 2. Item 하안선 기준요소 부분 찾기.
 * 3. 1,2 번에서 찾은걸로 y축 범위 결정하기.
 * 4. 상품명, 단가 가로축 범위 결정하기.
 */
 function findItemRangeUntilUnitPrice(textAnnotations, fullTextAnnotationPlusStudy) {

    // 1. 상품명 단가 수량 금액 라인 찾기
    const productName = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /상품명/)
    const unitPrice = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /단가/)
    const quantity = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /수량/)
    const amount = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /금액/)

    let productNameIndex: number;
    let unitPriceIndex: number;
    let quantityIndex: number;
    let amountIndex: number;

    let unitPriceAverageY: number;
    let quantityAverageY: number;
    
    // 상품명과 단가를 비교하여 세로축이 가장 인접한것 매칭
    let difference = 999;
    productName.forEach((productNameEle, productNameEleIdx) => {
        unitPrice.forEach((unitPriceEle, unitPriceEleIdx) => {
            const productNameEleAverageY = calAverageXorY(productNameEle, "y")
            const unitPriceEleAverageY = calAverageXorY(unitPriceEle, "y")
            const newDifference = Math.abs(productNameEleAverageY - unitPriceEleAverageY)
            if (newDifference < difference) {
                difference = newDifference
                productNameIndex = productNameEleIdx
                unitPriceIndex = unitPriceEleIdx
                unitPriceAverageY = unitPriceEleAverageY
            }
        })
    });

    // 단가를 기준으로 세로축방향으로 가장 인접한 수량 찾기
    difference = 999;
    quantity.forEach((quantityEle, quantityEleIdx) => {
        const quantityEleAverageY = calAverageXorY(quantityEle, "y")
        const newDifference = Math.abs(unitPriceAverageY - quantityEleAverageY)
        if (newDifference < difference) {
            difference = newDifference
            quantityIndex = quantityEleIdx
            quantityAverageY = quantityEleAverageY
        }
    });

    // 수량을 기준으로 세로축방향으로 가장 인접한 금액 찾기
    difference = 999;
    amount.forEach((amountEle, amountEleIdx) => {
        const amountEleAverageY = calAverageXorY(amountEle, "y")
        const newDifference = Math.abs(quantityAverageY - amountEleAverageY)
        if (newDifference < difference) {
            difference = newDifference
            amountIndex = amountEleIdx
        }
    });

    // 2. 아이템 y축 하안선 기준요소 찾기
    let itemYBottomPin = []
    const taxExemptionMsg = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /표시 상품은 부가세 면세품목입니다/)
    if (taxExemptionMsg === null) {
        const taxProductAmountMsg = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /과세물품/)
        itemYBottomPin = taxProductAmountMsg
    }
    else {
        itemYBottomPin = taxExemptionMsg
    }

    // 3. 1,2 번에서 찾은걸로 y축 범위 결정하기
    const productNameYs = getXorYArr(productName[productNameIndex], "y")
    const unitPriceYs = getXorYArr(unitPrice[unitPriceIndex], "y")
    const quantityYs = getXorYArr(quantity[quantityIndex], "y")
    const amountYs = getXorYArr(amount[amountIndex], "y")
    const minY = Math.max(...productNameYs, ...unitPriceYs, ...quantityYs, ...amountYs)
    // maxY 는 itemYBottomPin 의 y 값 중에서 2번째로 작은값 (대체적으로 수평인 다양한 기울기에서 이게 기하학적으로 제일 안전하다)
    const maxY = getXorYArr(itemYBottomPin[0], "y")
        .sort((a, b) => a - b)[1]

    // 4. 상품명 단가 수량 금액들의 가로축 범위 결정하기
    // const unitPriceAverageX = calAverageXorY(unitPrice[unitPriceIndex], "x")
    const unitPriceMaxX = Math.max(...getXorYArr(unitPrice[unitPriceIndex], "x"))
    const textAnnotationsMinX = Math.min(...getXorYArr(textAnnotations[0], "x", true))
    // const textAnnotationsMaxX = Math.max(...getXorYArr(textAnnotations[0], "x", true))
    // const productNameRangeX = [textAnnotationsMinX,unitPriceAverageX]
    const productNameRangeX = [textAnnotationsMinX,unitPriceMaxX]
    const quantityMinX = Math.min(...getXorYArr(quantity[quantityIndex], "x"))
    // const quantityAverageX = calAverageXorY(quantity[quantityIndex], "x")
    const unitPriceRangeX = [unitPriceMaxX,quantityMinX]
    // const unitPriceGroupMaxX = Math.max(...getXorYArr(unitPriceGroup[unitPriceIndex], "x", true)) // 단가 그룹의 맨위와 맨밑의 최대 x값
    // const quantityMaxX = Math.max(...getXorYArr(quantity[quantityIndex], "x"))
    // const amountMinX = Math.min(...getXorYArr(amount[amountIndex], "x"))
    // const quantityRangeX = [quantityMinX,(quantityMaxX+amountMinX)/2]
    // const quantityRangeX = [quantityAverageX,(quantityMaxX+amountMinX)/2]
    // const amountMaxX = Math.max(...getXorYArr(amount[amountIndex], "x"))
    // const amountRangeX = [amountMinX,amountMaxX]
    // const amountRangeX = [(quantityMaxX+amountMinX)/2,textAnnotationsMaxX]
    const itemRangeY = [minY,maxY]

    return {productNameRangeX, unitPriceRangeX, itemRangeY, quantity:quantity[quantityIndex], amount:amount[amountIndex]}
};

/**
 * #### 영수증 위치해석 & 읽을 text 위치 결정 // 단가 이후
 * 
 * 1. 수량 금액 가로축 범위 결정하기.
 */
 function findItemRangeQuantityAmount(textAnnotations, quantity, amount, unitPriceGroup) {

    /* // 1. 상품명 단가 수량 금액 라인 찾기
    const productName = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /상품명/)
    const unitPrice = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /단가/)
    const quantity = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /수량/)
    const amount = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /금액/)

    let productNameIndex: number;
    let unitPriceIndex: number;
    let quantityIndex: number;
    let amountIndex: number;

    let unitPriceAverageY: number;
    let quantityAverageY: number;
    
    // 상품명과 단가를 비교하여 세로축이 가장 인접한것 매칭
    let difference = 999;
    productName.forEach((productNameEle, productNameEleIdx) => {
        unitPrice.forEach((unitPriceEle, unitPriceEleIdx) => {
            const productNameEleAverageY = calAverageXorY(productNameEle, "y")
            const unitPriceEleAverageY = calAverageXorY(unitPriceEle, "y")
            const newDifference = Math.abs(productNameEleAverageY - unitPriceEleAverageY)
            if (newDifference < difference) {
                difference = newDifference
                productNameIndex = productNameEleIdx
                unitPriceIndex = unitPriceEleIdx
                unitPriceAverageY = unitPriceEleAverageY
            }
        })
    });

    // 단가를 기준으로 세로축방향으로 가장 인접한 수량 찾기
    difference = 999;
    quantity.forEach((quantityEle, quantityEleIdx) => {
        const quantityEleAverageY = calAverageXorY(quantityEle, "y")
        const newDifference = Math.abs(unitPriceAverageY - quantityEleAverageY)
        if (newDifference < difference) {
            difference = newDifference
            quantityIndex = quantityEleIdx
            quantityAverageY = quantityEleAverageY
        }
    });

    // 수량을 기준으로 세로축방향으로 가장 인접한 금액 찾기
    difference = 999;
    amount.forEach((amountEle, amountEleIdx) => {
        const amountEleAverageY = calAverageXorY(amountEle, "y")
        const newDifference = Math.abs(quantityAverageY - amountEleAverageY)
        if (newDifference < difference) {
            difference = newDifference
            amountIndex = amountEleIdx
        }
    }); */

    /* // 2. 아이템 y축 하안선 기준요소 찾기
    let itemYBottomPin = []
    const taxExemptionMsg = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /표시 상품은 부가세 면세품목입니다/)
    if (taxExemptionMsg === null) {
        const taxProductAmountMsg = getFulltextAnnoObjByReg(fullTextAnnotationPlusStudy, /과세물품/)
        itemYBottomPin = taxProductAmountMsg
    }
    else {
        itemYBottomPin = taxExemptionMsg
    } */

    /* // 3. 1,2 번에서 찾은걸로 y축 범위 결정하기
    const productNameYs = getXorYArr(productName[productNameIndex], "y")
    const unitPriceYs = getXorYArr(unitPrice[unitPriceIndex], "y")
    const quantityYs = getXorYArr(quantity[quantityIndex], "y")
    const amountYs = getXorYArr(amount[amountIndex], "y")
    const minY = Math.max(...productNameYs, ...unitPriceYs, ...quantityYs, ...amountYs)
    // maxY 는 itemYBottomPin 의 y 값 중에서 2번째로 작은값 (대체적으로 수평인 다양한 기울기에서 이게 기하학적으로 제일 안전하다)
    const maxY = getXorYArr(itemYBottomPin[0], "y")
       .sort((a, b) => a - b)[1] */

    // 4. 상품명 단가 수량 금액들의 가로축 범위 결정하기
    // const unitPriceAverageX = calAverageXorY(unitPrice[unitPriceIndex], "x")
    // const unitPriceMaxX = Math.max(...getXorYArr(unitPrice[unitPriceIndex], "x"))
    // const textAnnotationsMinX = Math.min(...getXorYArr(textAnnotations[0], "x", true))
    const textAnnotationsMaxX = Math.max(...getXorYArr(textAnnotations[0], "x", true))
    // const productNameRangeX = [textAnnotationsMinX,unitPriceAverageX]
    // const productNameRangeX = [textAnnotationsMinX,unitPriceMaxX]
    // const quantityMinX = Math.min(...getXorYArr(quantity[quantityIndex], "x"))
    // const quantityAverageX = calAverageXorY(quantity, "x")
    // const unitPriceRangeX = [unitPriceMaxX,quantityMinX]
    const unitPriceGroupMaxX = Math.max( // 단가 그룹의 맨위와 맨밑의 최대 x값
        Math.max(...getXorYArr(unitPriceGroup[0], "x")),
        Math.max(...getXorYArr(unitPriceGroup[unitPriceGroup.length-1], "x"))
    )
    const quantityMaxX = Math.max(...getXorYArr(quantity, "x"))
    const amountMinX = Math.min(...getXorYArr(amount, "x"))
    // const quantityRangeX = [quantityMinX,(quantityMaxX+amountMinX)/2]
    const quantityRangeX = [unitPriceGroupMaxX,(quantityMaxX+amountMinX)/2]
    // const amountMaxX = Math.max(...getXorYArr(amount[amountIndex], "x"))
    // const amountRangeX = [amountMinX,amountMaxX]
    const amountRangeX = [(quantityMaxX+amountMinX)/2,textAnnotationsMaxX]
    // const itemRangeY = [minY,maxY]

    return {quantityRangeX, amountRangeX}
};

function calAverageXorY(fullTextAnooObj, coordinate:"x"|"y") {
    return fullTextAnooObj[1].boundingBox.vertices.reduce((acc, cur) => acc + cur[coordinate], 0) / 4
};

function getXorYArr(AnnoObj, coordinate:"x"|"y", isTextAnno?) {
    if (isTextAnno === true) {
        return AnnoObj.boundingPoly.vertices.map((v) => v[coordinate])
    }
    else {
        return AnnoObj[1].boundingBox.vertices.map((v) => v[coordinate])
    }
};

/**
 * #### 완전 속해있으면 반환하고 걸쳐있으면 탐구하고 아예 안걸쳐있으면 패스하는 탐색
 * <주의> 페이지 1개인 경우만 고려되었음
 */
function getFulltextAnnoObjByRange(
    fullTextAnnotationPlusStudy,
    rangeX/*[overX, underX]*/,
    rangeY/*[overY, underY]*/,
    includeSymbols: boolean,
    continueOptions?/*{includeWords:boo, word:0|1, includeSymbols:boo, symbol:0|1}*/
) {
    let result = [];

    fullTextAnnotationPlusStudy.pages[0].blocks.forEach((block, blockIndex) => {
        const compare = compareVertices(block.boundingBox.vertices)
        if (compare[0] === true && compare[1] === true) {
            result.push([new idx(0, blockIndex), block])
        }
        else if (
            (compare[0] === "continue" || compare[1] === "continue") &&
            (compare[0] !== false && compare[1] !== false)
        ) {
            block.paragraphs.forEach((paragraph, paragraphIndex) => {
                const compare = compareVertices(paragraph.boundingBox.vertices)
                if (compare[0] === true && compare[1] === true) {
                    result.push([new idx(0, blockIndex, paragraphIndex), paragraph])
                }
                else if (
                    (compare[0] === "continue" || compare[1] === "continue") &&
                    (compare[0] !== false && compare[1] !== false)
                ) {
                    paragraph.words.forEach((word, wordIndex) => {
                        const compare = compareVertices(word.boundingBox.vertices)
                        if (compare[0] === true && compare[1] === true) {
                            result.push([new idx(0, blockIndex, paragraphIndex, wordIndex), word])
                        }
                        else if (
                            (compare[0] === "continue" || compare[1] === "continue") &&
                            (compare[0] !== false && compare[1] !== false)
                        ) {
                            if (includeSymbols) {
                                word.symbols.forEach((symbol, symbolIndex) => {
                                    const compare = compareVertices(symbol.boundingBox.vertices)
                                    if (compare[0] === true && compare[1] === true) {
                                        result.push([new idx(0, blockIndex, paragraphIndex, wordIndex, symbolIndex), symbol])
                                    }
                                    else if (
                                        continueOptions.includeSymbols &&
                                        (compare[0] === "continue" || compare[1] === "continue") &&
                                        (compare[0] !== false && compare[1] !== false)
                                    ) {
                                        if (continueOptions.symbol !== undefined) {
                                            if (compare[continueOptions.symbol] === true) {
                                                result.push([new idx(0, blockIndex, paragraphIndex, wordIndex, symbolIndex), symbol, 'continue'])
                                            }
                                        }
                                        else {
                                            result.push([new idx(0, blockIndex, paragraphIndex, wordIndex, symbolIndex), symbol, "continue"])
                                        }
                                    }
                                })
                            }
                            else if (continueOptions && continueOptions.includeWords) {
                                if (continueOptions.word !== undefined) {
                                    if (compare[continueOptions.word] === true) {
                                        result.push([new idx(0, blockIndex, paragraphIndex, wordIndex), word, "continue"])
                                    }
                                }
                                else {
                                    result.push([new idx(0, blockIndex, paragraphIndex, wordIndex), word, "continue"])
                                }
                            }
                        }
                    })
                }
            })
        }
    });
    return result;

    /**
     * 완전 속해있으면 true, 완전 분리되어있으면 false, 걸쳐있으면 "continue" 반환
    */
    function compareVertices(vertices) {
        const verticesX = []
        const verticesY = []
        vertices.forEach((vertex) => {
            verticesX.push(vertex.x)
            verticesY.push(vertex.y)
        })
        const maxX = Math.max(...verticesX)
        const minX = Math.min(...verticesX)
        const maxY = Math.max(...verticesY)
        const minY = Math.min(...verticesY)

        return [compareRange(minX, maxX, rangeX), compareRange(minY, maxY, rangeY)]

        function compareRange(min, max, range) {
            if ( // 완전 속해있음
                min > range[0] && max < range[1]
            ) {
                return true
            }
            else if ( // 완전 분리되어있음
                (min <= range[0] && max <= range[0]) || (max >= range[1] && min >= range[1])
            ) {
                return false
            }
            else {
                return "continue"
            }
        }
    };
};

/**
 * #### y축 기준 정렬
 */
function sortGroupAscByY(group) {
    return group.sort((a,b) => {
        const aVerticesY = a[1].boundingBox.vertices.map((v) => v.y)
        const bVerticesY = b[1].boundingBox.vertices.map((v) => v.y)
        return Math.min(...aVerticesY) - Math.min(...bVerticesY)
    })
};

/**
 * #### 각 그룹으로부터 텍스트배열을 만들어낸다.
 * 단, undefined 를 영수증의 빈곳에 잘 넣어주기만 하면 된다.
 * 
 * 상품명이 아래와 같을때 해당칼럽과 열에 빈곳이 존재한다.
 * * 행사할인 : 단가, 수량.
 * * 카드할인 : 단가, 수량.
 * * 쿠폰할인 : 수량.
 */
function getTextArraysFromGroups(productNameGroup, unitPriceGroup, quantityGroup, amountGroup) {

    // 각 Group 순회하며 Arr 만들기 (\n 기준으로 split 해서 배열로 만들어준다.)
    const productNameArray = makeProductNameArrFromGroup(productNameGroup);
    const unitPriceArray = makeArrFromGroup(unitPriceGroup);
    const quantityArray = makeArrFromGroup(quantityGroup);
    const amountArray = makeAmountArrFromGroup(amountGroup);

    // 상품명 arr 에서 특정상품명이 발견되는 index 로 단가 수량 arr 에 undefined 삽입
    productNameArray.forEach((productName, index) => {
        if (productName.includes("행사할인")) {
            unitPriceArray.splice(index, 0, undefined);
            quantityArray.splice(index, 0, undefined);
        }
        else if (productName.includes("쿠폰할인")) {
            quantityArray.splice(index, 0, undefined);
        }
        else if (productName.includes("카드할인")) {
            unitPriceArray.splice(index, 0, undefined);
            quantityArray.splice(index, 0, undefined);
        }
    })

    // console.log(productNameArray)
    // console.log(unitPriceArray)
    // console.log(quantityArray)
    // console.log(amountArray)

    // 4개의 배열의 길이가 모두 같으면 정상임. 정상이면 완성된 배열들 리턴
    if (
        productNameArray.length === unitPriceArray.length &&
        unitPriceArray.length === quantityArray.length &&
        quantityArray.length === amountArray.length
    ) {
        return {productNameArray, unitPriceArray, quantityArray, amountArray};
    }
    else {
        return null;
    }

    /**
     * 기본적인 범용 툴
     */
    function makeArrFromGroup(group) {
        let arr = []
        group.forEach((item) => {
            item[1].text.split('\n').forEach((text) => {
                if (text !== '') {
                    arr.push(text)
                }
            })
        })
        return arr
    };

    /**
     * 상품명 전용 툴
     * 
     * - 하나의 아이템으로 찾아야할것을 word level 로 쪼개져 찾을경우 솔루션
     * - 시작 문자열이 두자리 숫자이거나 특정메시지가 포함됬을경우만 하나의 열로 인식하도록 함
     * - 할인정보 항목이 상품명 항목과 이어붙는 경우 핸들링
     * 
     * 중복코드 정리 필요
     */
    function makeProductNameArrFromGroup(group) {
        // 그룹 요소중에 word level 로 쪼개서 찾아진내용은 순서대로 이어붙인다음 \n 검사해야함.
        let arr = []
        let wordToParagraph = [] // disorderly 등장하는 word 를 재대로 이어붙이기위해 인덱스별 배열에 담아줌
        let tempPageIdx = NaN
        let tempBlockIdx = NaN
        let tempParagraphIdx = NaN
        group.forEach((item) => {
            const {pageIdx, blockIdx, paragraphIdx, wordIdx} = item[0]
            if (wordIdx !== undefined) { // word level 로 쪼개져 찾아진내용이면
                if (tempPageIdx === NaN && tempBlockIdx === NaN && tempParagraphIdx === NaN) {
                    wordToParagraph[wordIdx] = item[1].text
                    tempPageIdx = pageIdx
                    tempBlockIdx = blockIdx
                    tempParagraphIdx = paragraphIdx
                }
                else if (tempPageIdx === pageIdx && tempBlockIdx === blockIdx && tempParagraphIdx === paragraphIdx) {
                    wordToParagraph[wordIdx] = item[1].text
                }
                else { // 이어서 새로운 paragraph 의 word 나열이 시작되면
                    wordToParagraph.join('').split('\n').forEach((text) => {
                        if (text !== '') {
                            if (/^[0-9]{2}/.test(text) || text.includes("행사할인") || text.includes("쿠폰할인") || text.includes("카드할인")) {
                                if (/^[0-9]{2}/.test(text) && /쿠폰할인+$|행사할인+$/.test(text)) {
                                    arr.push(text.slice(0, text.length-4))
                                    arr.push(text.slice(text.length-4))
                                }
                                else {
                                    arr.push(text)
                                }
                            }
                            else {
                                arr[arr.length-1] += text
                            }
                        }
                    })
                    wordToParagraph = []
                    wordToParagraph[wordIdx] = item[1].text
                    tempPageIdx = pageIdx
                    tempBlockIdx = blockIdx
                    tempParagraphIdx = paragraphIdx
                }
            }
            else { // 정상 paragraph level 로 찾아진내용이면
                if (wordToParagraph.length > 0) { // 이전에 word level 로 쪼개져 찾아진내용이 있으면 처리하고 진행
                    wordToParagraph.join('').split('\n').forEach((text) => {
                        if (text !== '') {
                            if (/^[0-9]{2}/.test(text) || text.includes("행사할인") || text.includes("쿠폰할인") || text.includes("카드할인")) {
                                if (/^[0-9]{2}/.test(text) && /쿠폰할인+$|행사할인+$/.test(text)) {
                                    arr.push(text.slice(0, text.length-4))
                                    arr.push(text.slice(text.length-4))
                                }
                                else {
                                    arr.push(text)
                                }
                            }
                            else {
                                arr[arr.length-1] += text
                            }
                        }
                    })
                    wordToParagraph = []
                }
                item[1].text.split('\n').forEach((text) => {
                    if (text !== '') {
                        if (/^[0-9]{2}/.test(text) || text.includes("행사할인") || text.includes("쿠폰할인") || text.includes("카드할인")) {
                            if (/^[0-9]{2}/.test(text) && /쿠폰할인+$|행사할인+$/.test(text)) {
                                arr.push(text.slice(0, text.length-4))
                                arr.push(text.slice(text.length-4))
                            }
                            else {
                                arr.push(text)
                            }
                        }
                        else {
                            arr[arr.length-1] += text
                        }
                    }
                })
            };
        })
        return arr
    };

    /**
     * amount 전용 툴
     * 
     * - symbol 레벨로 쪼개져 찾는경우 솔루션
     * 
     */
    function makeAmountArrFromGroup(group) {
        let arr = []
        let symbolToWord = []
        let tempPageIdx = NaN
        let tempBlockIdx = NaN
        let tempParagraphIdx = NaN
        let tempWordIdx = NaN
        group.forEach((item) => {
            const {pageIdx, blockIdx, paragraphIdx, wordIdx, symbolIdx} = item[0]
            if (symbolIdx !== undefined) {
                if (tempPageIdx === NaN && tempBlockIdx === NaN && tempParagraphIdx === NaN && tempWordIdx === NaN) {
                    symbolToWord[symbolIdx] = item[1].text
                    tempPageIdx = pageIdx
                    tempBlockIdx = blockIdx
                    tempParagraphIdx = paragraphIdx
                    tempWordIdx = wordIdx
                }
                else if (tempPageIdx === pageIdx && tempBlockIdx === blockIdx && tempParagraphIdx === paragraphIdx && tempWordIdx === wordIdx) {
                    symbolToWord[symbolIdx] = item[1].text
                }
                else {
                    symbolToWord.join('').split('\n').forEach((text) => {
                        if (text !== '') {
                            arr.push(text)
                        }
                    })
                    symbolToWord = []
                    symbolToWord[symbolIdx] = item[1].text
                    tempPageIdx = pageIdx
                    tempBlockIdx = blockIdx
                    tempParagraphIdx = paragraphIdx
                    tempWordIdx = wordIdx
                }
            }
            else {
                if (symbolToWord.length > 0) {
                    symbolToWord.join('').split('\n').forEach((text) => {
                        if (text !== '') {
                            arr.push(text)
                        }
                    })
                    symbolToWord = []
                }
                item[1].text.split('\n').forEach((text) => {
                    if (text !== '') {
                        arr.push(text)
                    }
                })
            }
        })
        return arr
    };
};

/**
 * #### 인자로 받은 배열의 요소가 숫자 두개로 시작하면 그 숫자 두개를 제거
 */
function deleteStartingTwoNumbersEachEleInArr(arr) {
    return arr.map((ele) => {
        return ele.replace(/^[0-9]{2}/, '')
    })
};

/**
 * #### 인자로 받은 배열의 요소가 공백으로 시작하거나 공백으로 끝나면 그 공백을 모두 제거
 */
function deleteSpacesEachEleOfFrontAndBackInArr(arr) {
    return arr.map((ele) => {
        if (ele === undefined) {
            return undefined
        }
        return ele.replace(/^[ ]+|[ ]+$/g, '')
    })
};

/**
 * #### 인자로 받은 배열의 요소에 모든쉼표를 제거
 * 
 * - 쉼표를 포인트(.)로 찾아버린것 제거
 */
function deleteAllCommaEachEleInArr(arr) {
    return arr.map((ele) => {
        if (ele === undefined) {
            return undefined
        }
        return ele.replace(/,|\./g, '')
    })
};

/**
 * #### 항목객체 배열 만들기
 * 
 * Receipt Object Define Version = 0.0.1
 */
function makeReceiptItemArray(productNameArr, unitPriceArr, quantityArr, amountArr):ReceiptItem[] {
    const receiptItemArray = [];
    productNameArr.forEach((productName, idx) => {
        // Discount 상품명 발견하면 Discount 객체 만들어서 바로 전 아이템에 넣어주기
        if (productName.includes("행사할인")) {
            const discount = new Discount(productName, amountArr[idx])
            receiptItemArray[receiptItemArray.length-1].addDiscount(discount)
        }
        else if (productName.includes("쿠폰할인")) {
            const discount = new Discount(productName, amountArr[idx], unitPriceArr[idx])
            receiptItemArray[receiptItemArray.length-1].addDiscount(discount)
        }
        else if (productName.includes("카드할인")) {
            const discount = new Discount(productName, amountArr[idx])
            receiptItemArray[receiptItemArray.length-1].addDiscount(discount)
        }
        else {
        // .|* 으로 시작하는것 발견하면 taxExemption = true 주고 .|* 제거하고 space 제거하기
            let taxExemption = false;
            if (productName.charAt(0) === "." || productName.charAt(0) === "*") {
                productName = productName.replace(/^./, '').replace(/^[ ]+/g, '')
                taxExemption = true;
            }
            receiptItemArray.push(
                new ReceiptItem(
                    new ItemReadFromReceipt(
                        productName,
                        unitPriceArr[idx],
                        quantityArr[idx],
                        amountArr[idx],
                        taxExemption
                    )
                )
            );
        };
    });
    return receiptItemArray
};
