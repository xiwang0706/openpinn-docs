ReLoBRaLo（``relobralo``）
============================================================

.. openpinn-method-summary:: adaptive_weights relobralo

大白话
------

它比较每项损失“相对初始值”和“相对上一步”的变化，再用随机回看和指数平滑更新
权重。权重之和保持在损失项数量附近，不作为模型参数求梯度；随机流会保存进
checkpoint。

放在哪里与怎么调用
------------------

核心在 ``losses.py`` 的 ``ReLoBRaLoLossComposer``；二级入口为
``methods/adaptive_weights/relobralo.py``。

.. code-block:: python

   result = op.solve(
       "poisson", method="adaptive_weights", variant="relobralo", steps=5000
   )

论文、代码与许可
------------------------------

依据 Bischof and Kraus, *Multi-Objective Loss Balancing for Physics-Informed
Deep Learning*, arXiv ``2110.09813``；正式发表为 CMAME 439 (2025) 117914，
DOI ``10.1016/j.cma.2025.117914``。仓库
``https://github.com/rbischof/relative_balancing`` 未检测到明确许可证，本实现仅按
论文公式独立编写。

300 步参考短跑
--------------

相对 L2 从 0.44732 变为 0.43392，但 PDE 残差从 1.35361 微升到 1.35557，
用时从 0.1476 s 增至 0.1536 s；最终 PDE/边界权重为 0.98310/1.01691。
这是混合结果。完整文件位于
``results/method_expansions/20260829/adaptive_weights/relobralo/``。
