# Notes on ownership

Each value in Rust has an *owner*, and there can only be **one owner** at a time.
When the owner goes out of scope, the value is dropped.

## Borrowing

- `&T` lets you read
- `&mut T` lets you change, but only *one* at a time
- references must never outlive the value

```rust
fn len(s: &String) -> usize {
    s.len()
}
```
