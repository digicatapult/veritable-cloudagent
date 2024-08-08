package suppliers

default allow = false

allow {
    input.method == "query"
    input.did != null
    input.did == input.suppliers[_]
}
