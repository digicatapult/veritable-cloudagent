package supplier_customer

default allow = false

customer_can_query(customerID, supplierID) {
    supplier := data.suppliers[supplierID]
    customerID == supplier.customers[_]
}

allow {
    input.method == "query"
    input.customerID != null
    input.supplierID != null
    customer_can_query(input.customerID, input.supplierID)
}