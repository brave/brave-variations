### Protobuf-ts and `required` fields

The `protobuf-ts` library is chosen for typescript-based seed generator as it
provides a robust mechanism to detect and report unknown fields and invalid
values when parsing content from an object-like representation (such as JSON).

However, the library targets `proto3`, while Variations proto files use
`proto2`, causing `required` fields with default values to be omitted during
serialization. The only `required` fields in variations are `name` and
`probability_weight`. `name` is always non-empty, but `probability_weight` can
be `0`. To ensure `protobuf-ts` serializes `0`, `study.proto` is patched to make
`probability_weight` be `optional` instead of `required`. This forces
`protobuf-ts` to serialize it explicitly even if it's set to `0`. We guarantee
the value is always set by processing studies after JSON parsing.
