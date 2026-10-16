多量级幂损失（``magnitude_power``）
===================================

.. openpinn-method-summary:: adaptive_weights magnitude_power

大白话
------

对不同损失使用 ``L**(1/r)`` 压缩数量级。这里的 ``r`` 是固定配置，不会随训练
自动更新，所以它只是放在“损失平衡”家族，不能称为自适应权重。

放在哪里与怎么调用
------------------

核心在 ``losses.py`` 的 ``MagnitudePowerLossComposer``；二级入口为
``methods/adaptive_weights/magnitude_power.py``。

.. code-block:: python

   result = op.solve(
       "poisson", method="adaptive_weights",
       variant="magnitude_power", steps=5000,
   )

论文、代码与许可
------------------------------

依据 Wang et al. (2024), *A practical PINN framework for multi-scale problems
with multi-magnitude loss terms*, DOI ``10.1016/j.jcp.2024.113112``。仓库
``https://github.com/wangyong1301108/MMPINN`` 未检测到明确许可证；OpenPINN 只
独立实现论文的损失幂变换，不包含多层网络/分组正则等其他组件，也不复制源码。

300 步参考短跑与失败说明
----------------------------------------

本次相对 L2 从 0.44732 **变差** 到 0.80827，PDE 残差从 1.35361 变为
5.69568；边界 RMSE 虽从 0.55984 降到 0.01517，但不能据此称整体改善。
用时 0.1533/0.1482 s，参数量相同。完整负结果保存在
``results/method_expansions/20260829/adaptive_weights/magnitude_power/``。
