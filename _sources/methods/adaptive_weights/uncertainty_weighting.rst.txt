不确定性权重（``uncertainty_weighting``）
=========================================

.. openpinn-method-summary:: adaptive_weights uncertainty_weighting

大白话
------

每个损失项学习一个对数方差 ``s``，实际系数是 ``exp(-s)``。持续表现为高噪声/
高不确定性的项会被降权，同时 ``+s`` 防止所有权重无限缩小。它不是 SA-PINN 的
“难点自动变重”机制。

放在哪里与怎么调用
------------------

核心在 ``losses.py`` 的 ``UncertaintyLossComposer``；二级入口为
``methods/adaptive_weights/uncertainty_weighting.py``。

.. code-block:: python

   result = op.solve(
       "poisson", method="adaptive_weights",
       variant="uncertainty_weighting", steps=5000,
   )

论文、代码与许可
------------------------------

依据 Kendall, Gal and Cipolla (2018), *Multi-Task Learning Using Uncertainty
to Weigh Losses for Scene Geometry and Semantics*, arXiv ``1705.07115``，以及
Hou et al. (2023) 在 PINN 中采用的相同形式。实现按公式独立编写，未复制代码。

300 步参考短跑
--------------

普通/改进相对 L2 为 0.44732/0.29337，PDE 残差为 1.35361/1.33685，
用时 0.1558/0.1701 s；最终 PDE/边界系数为 0.90697/1.06661，新增 2 个参数。
结果位于 ``results/method_expansions/20260829/adaptive_weights/uncertainty_weighting/``。
