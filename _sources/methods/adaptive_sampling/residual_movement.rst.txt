RAM 残差配点移动（``residual_movement``）
=========================================

.. openpinn-method-summary:: adaptive_sampling residual_movement

大白话
------

先把内部训练点分成“固定点”和“可移动点”。每隔若干步计算候选点的 PDE 残差，
残差越大的地方越容易接收一个可移动点。固定点保留全局覆盖，总训练点数不增加。
这与旧 ``residual_adaptive`` 整批重选不是同一个变体。

放在哪里与怎么调用
------------------

* 核心：``sampling.py`` 的 ``AdaptiveMovementSampler``；
* 二级入口：``methods/adaptive_sampling/residual_movement.py``；
* 配置：``configs/methods/adaptive_sampling/residual_movement.yaml``。

.. code-block:: python

   result = op.solve(
       "poisson", method="adaptive_sampling",
       variant="residual_movement", steps=5000,
   )

论文、代码与许可
------------------------------

核心论文是 Hou, Li and Ying (2023), *Enhancing PINNs for solving PDEs via
adaptive collocation point movement and adaptive loss weighting*, DOI
``10.1007/s11071-023-08654-w``。论文给出的仓库是
``https://github.com/hsbhc/AMAW-PINN``；核对时未检测到许可证或顶层 LICENSE，
所以本实现只依据论文的 RAM 概率和固定/移动点描述独立编写，没有复制源码。

300 步参考短跑
--------------

同一 Poisson、24×2 MLP、48 个内部点、12 个边界点和种子下，普通 PINN 与 RAM
的相对 L2 分别为 0.44732 和 0.10526，PDE 残差 RMSE 为 1.35361 和 0.57320；
用时 0.1528 s 和 0.1436 s。RAM 完成 5 次移动，每次固定 24 点、移动 24 点。
结果位于 ``results/method_expansions/20260829/adaptive_sampling/residual_movement/``。
这是接入验证，不是收敛或统计优越性结论。
