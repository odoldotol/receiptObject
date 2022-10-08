// 영수증 객체
class Receipt {

    public provider: Provider
    public itemArray: ReceiptItem[]
    public readFromReceipt: ReceiptReadFromReceipt
    public providerInput: ProviderInput
    public outputRequests: OutputRequest[]

    constructor(
        emailAddress: string,
        public imageAddress: string,
        receiptStyle: string,
    ) {
        this.provider = new Provider(emailAddress)
        this.providerInput = new ProviderInput(receiptStyle)
        this.readFromReceipt = new ReceiptReadFromReceipt()
        this.outputRequests = []
    };

    /**
     * #### itemArray 완성
     * 4개의 배열을 인자로 받음 (당연히 길이가 같아야함)
     */
    readReceiptItems(productNameArr: Array<string|undefined>, unitPriceArr: Array<number|undefined>, quantityArr: Array<number|undefined>, amountArr: Array<number|undefined>) {
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
            // .|*|: 으로 시작하는것 발견하면 taxExemption = true 주고 .|*|: 제거하고 space 제거하기 // : 가 포함된게 여간 찜찜하지만 일단 두고보자
                let taxExemption = false;
                if (productName.charAt(0) === "." || productName.charAt(0) === "*" || productName.charAt(0) === ":") {
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
        this.itemArray = receiptItemArray;
    };

    /**
     * 영수증 정보를 readFromReceipt 에 넣기
     */
    readReceiptInfo(receiptInfo) {
        this.readFromReceipt.setReceiptInfo(receiptInfo)
    }

    /**
     * ShopInfo 를 readFromReceipt 에 넣기
     */
    readShopInfo(shopInfo) {
        this.readFromReceipt.setShopInfo(shopInfo)
    }

    /**
     * taxSummary 를 readFromReceipt 에 넣기
     */
    readTaxSummary(taxSummary) {
        this.readFromReceipt.setTaxSummary(taxSummary)
    }

    /**
     * 
     */
    addOutputRequest(requestDate, sheetFormat, emailAddress, requestType) {
        this.outputRequests.push(new OutputRequest(requestDate, sheetFormat, emailAddress, requestType))
    };

    /**
     * 
     */
    completeOutputRequest(result) { // 임시
        this.outputRequests[this.outputRequests.length-1].setOutputResult(result)
    }

    /**
     * 
     */
    complete() {
        /** 체크, 보정
         * 
         * - 각 item 안에 있는 check 들
         * - 모든 item amount 의 합이 총합계와 같은지
         * - 모든 item 의 discount amount 의 합이 모든 총할인 합과 같은지
         * - 구매금액 = 총합계 - 모든 총할인
         *  문제가 있을경우 더 많은 조건들을 체크하면서 점검, 보정해서 완성할 수 있어야한다. (조건은 충분해 보임)
         * 
         * 과세 정보 섹션 체크 (과세품목 정확히 알아낼 수 있어야한다)
         * 결제 섹션 체크
         */

        // 체크, 보정 다 끝나면
        this.itemArray.forEach(item => {
            item.complete()
        })
        // 결제섹션에서 결제할인 된것 각 item 별 구매금액에서 퍼센드로 계산해서 실 구매가 계산해주기
    };
};

// -------------------------------------------------------------------------

    class Provider {

        constructor(
            public emailAddress: string,
        ) {}
    };

    // 구매 아이템 객체
    class ReceiptItem {

        constructor(
            public readFromReceipt: ItemReadFromReceipt,
            public category?: string
        ) {}

        public itemDiscountAmount: number;
        public purchaseAmount: number;

        /**
         * 할인금액 음수인지 확인하기
         */
        discountAmountIsNegative() {
            let result = []
            this.readFromReceipt.discountArray.forEach((discount, idx) => {
                if (discount.amount > 0) {
                    result.push(idx)
                }
            })
            if (result.length === 0) {
                return true
            }
            else {
                return result
            }
        }

        /**
         * 단가 x 수량 === 금액
         */
        amountEqualsUnitpriceXquantity() {
            return this.readFromReceipt.unitPrice * this.readFromReceipt.quantity === this.readFromReceipt.amount
        }
        
        /**
         * discount 추가하기
         */
        addDiscount(discount: Discount) {
            this.readFromReceipt.discountArray.push(discount)
        }

        /**
         * 할인금액 합산하기
         */
        protected sumDiscountAmount() {
            this.itemDiscountAmount = this.readFromReceipt.discountArray.reduce((acc, cur) => acc + cur.amount, 0)
        }

        /**
         * 구매금액 계산하기
         */
        protected calPurchaseAmount() {
            this.purchaseAmount = this.readFromReceipt.amount + this.itemDiscountAmount
        }

        /**
         * #### 완성하기
         * 
         * - 궁극적으로는 readFromReceipt 에서 사용할수있는 모든것들을 밖으로 빼야한다.
         * - 지금은 readFromReceipt 를 사용중.
         */
        complete() {
            // 완성이 안됬으면 실행할 수 않는 어떤 조건을 주고싶다.
            this.sumDiscountAmount()
            this.calPurchaseAmount()
        }
    };

        // 구매 아이템의 영수증에서 읽은 rare data
        class ItemReadFromReceipt {

            public unitPrice: number
            public quantity: number
            public amount: number

            constructor(
                public productName: string,
                unitPrice: number,
                quantity: number,
                amount: number,
                public taxExemption?: boolean,
            ) {
                this.unitPrice = Number(unitPrice)
                this.quantity = Number(quantity)
                this.amount = Number(amount)
            }
            public discountArray: Discount[] = [];
        };

            class Discount {

                public amount: number
                public code?: number

                constructor(
                    public name: string,
                    amount: number,
                    code?: number
                ) {
                    this.amount = Number(amount)
                    if (code !== undefined) this.code = Number(code)
                }
            };

    // 영수증에서 읽은 영구증의 rare data
    class ReceiptReadFromReceipt {

        public date: Date
        public name: string
        public tel: string
        public address: string
        public owner: string
        public businessNumber: string
        public taxProductAmount: number
        public taxAmount: number
        public taxExemptionProductAmount: number
        public tm?: string
        public no?: string
        //총가격
        //할인
        //결제

        constructor() {}

        /**
         * 
         */
        setReceiptInfo({receiptDate}) {
            this.date = receiptDate
        }

        /**
         * 
         */
        setShopInfo({name, tel, address, owner, businessNumber}) {
            this.name = name
            this.tel = tel
            this.address = address
            this.owner = owner
            this.businessNumber = businessNumber
        }

        /**
         * 
         */
        setTaxSummary({taxProductAmount, taxAmount, taxExemptionProductAmount}) {
            this.taxProductAmount = Number(taxProductAmount)
            this.taxAmount = Number(taxAmount)
            this.taxExemptionProductAmount = Number(taxExemptionProductAmount)
        }
    };

    class ProviderInput {

        constructor(
            public receiptStyle: string|null,
        ) {}
    }

    class OutputRequest {

        public result: any // 임시 형태

        constructor(
            public requestDate: Date,
            public sheetFormat: string,
            public emailAddress: string,
            public requestType: 'provided'|'general',
        ) {}

        /**
         * 
         */
        setOutputResult(result: any) { // 임시
            this.result = result
        }
    };

export { Receipt, Provider, ReceiptItem, ReceiptReadFromReceipt, ProviderInput, OutputRequest }
