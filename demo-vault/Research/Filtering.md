---
aliases:
  - 狀態估測
tags:
  - robotics/estimation
---

# Filtering

A filter updates an estimate when new evidence arrives.

> [!note] Preserve the source
> This is synthetic testing material, not a claim about a real lecture.

## Update

$$
\hat{x}_{k} = \hat{x}_{k}^{-} + K_k (y_k - H\hat{x}_{k}^{-})
$$

See [[Sources/Filter Notes]] for the synthetic source.
