# Packages

Packages contain reusable code with no host ownership. The current package is [contracts](contracts/README.md).

`packages/product-core` is an intended home for pure product state and policy calculations, but it is not implemented yet. Extract code there only when a real cross-host pure domain boundary exists; do not create a decorative package.
