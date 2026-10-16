损失重要性采样（``importance_sampling``）
=========================================

.. openpinn-method-summary:: adaptive_sampling importance_sampling

大白话
------

高损失候选点更容易被抽中，但不能只挑难点后直接求平均，否则目标会偏。
本变体同时保存每个抽中点的 ``1/(N q_i)`` 修正权重，让候选池均值的估计保持一致。
边界和初值仍均匀采样。

放在哪里与怎么调用
------------------

核心在 ``sampling.py`` 的 ``ImportanceSamplingSampler``；强形式损失在
``formulations.py`` 使用抽样权重；二级入口为
``methods/adaptive_sampling/importance_sampling.py``。

.. code-block:: python

   result = op.solve(
       "poisson", method="adaptive_sampling",
       variant="importance_sampling", steps=5000,
   )

论文、代码与许可
------------------------------

依据 Nabian, Meidani and Farimani (2021), *Efficient training of
physics-informed neural networks via importance sampling*, DOI
``10.1111/mice.12685``。论文中最优抽样分布与梯度范数有关，并用逐点损失近似；
OpenPINN 独立实现了有限候选池版本，没有复制外部代码。

300 步参考短跑
--------------

普通 PINN/重要性采样相对 L2 为 0.44732/0.25465，PDE 残差 RMSE 为
1.35361/0.63965，用时 0.1484/0.1404 s。最后一次平均逆概率修正权重为
0.95954。完整文件位于
``results/method_expansions/20260829/adaptive_sampling/importance_sampling/``。
极小抽样概率可能产生大修正权重，正式实验必须继续检查方差与稳定性。
