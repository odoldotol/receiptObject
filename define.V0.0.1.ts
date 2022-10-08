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
}

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
}

class ReceiptItem {

    constructor(
        public readFromReceipt: ItemReadFromReceipt,
        public category?: string
    ) {}

    public itemDiscountAmount: number;
    public purchaseAmount: number;
    
    /**
     * discount 추가하기
     */
    addDiscount(discount: Discount) {
        this.readFromReceipt.discountArray.push(discount)
    }

    /**
     * 할인금액 합산하기
     */
    sumDiscountAmount() {
        this.itemDiscountAmount = this.readFromReceipt.discountArray.reduce((acc, cur) => acc + cur.amount, 0)
    }

    /**
     * 구매금액 계산하기
     */
    calPurchaseAmount() {
        this.purchaseAmount = this.readFromReceipt.amount + this.itemDiscountAmount
    }
}

class ReceiptReadFromReceipt {

    constructor(
        //시간
        //총가격
        //할인
        //결제
    ) {}
}

class Provider {

    constructor(
        public emailAddress: string,
    ) {}
}

class OutputRequest {

    constructor(
        // 언제 어떤방식으로 어디로, 실행.성공여부?
    ) {}
}

class Receipt {

    constructor(
        public provider: Provider,
        public itemArray: ReceiptItem[],
        public readFromReceipt?: ReceiptReadFromReceipt,
        public providerInput?,
        public outputRequests?: OutputRequest[],
        public imageAddress?: string,
    ) {
        this.itemArray.forEach(item => {
            item.sumDiscountAmount()
            item.calPurchaseAmount()
        })
        // // purchaseAmount 계산하기
        // itemArray.forEach(item => {
        //     item.purchaseAmount = item.readFromReceipt.amount;
        //     item.readFromReceipt.discountArray.forEach(discount => {
        //         item.purchaseAmount += discount.amount;
        //     })
        // })
    }
}

export {ReceiptItem, Discount, ItemReadFromReceipt, Receipt, Provider}
