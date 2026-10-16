Adam + L-BFGS：先找方向，再做二阶收尾
=========================================

.. openpinn-method-summary:: adam_lbfgs adam_then_lbfgs

这是什么
----------

Adam 的每个外层步通常只计算一次损失和梯度，前期比较稳。L-BFGS 每个外层步
可以反复调用 closure，利用曲率近似继续降低已经较小的损失。两段法保留同一个
网络参数，达到指定步数后从 Adam 切到 L-BFGS。

放在哪里
----------

* 阶段切换：``src/openpinn/optimizers.py`` 的 ``StagedOptimizerAdapter``；
* 统一调用：``optimizer.name: adam_lbfgs`` 和 ``optimizer.stages``；
* 对比入口：``examples/poisson_adam_lbfgs.py``。

依据与许可
----------

* 核心论文：Rathore et al., *Challenges in Training PINNs: A Loss
  Landscape Perspective*, Proceedings of Machine Learning Research 235
  (ICML 2024)，``https://proceedings.mlr.press/v235/rathore24a.html``。
* 参考仓库：``https://github.com/pratikrathore8/opt_for_pinns``。该仓库顶层未见明确
  顶层明确 LICENSE，不复制仓库实现。
* 本项目只组合已有的 PyTorch Adam/L-BFGS 适配器，阶段容器为独立编写。

统一配置
----------

.. code-block:: yaml

   optimizer:
     name: adam_lbfgs
     stages:
       - {name: adam, steps: 1000, lr: 0.001}
       - {name: lbfgs, steps: 20, lr: 1.0, max_iter: 10}

``training.steps`` 必须等于两段 ``steps`` 之和，配错时直接报错，不默默忽略任一段。

最短调用
--------

.. code-block:: python

   import openpinn as op
   result = op.solve(
       "poisson", method="adam_lbfgs", variant="adam_then_lbfgs", steps=5000
   )

怎么跑
------

.. code-block:: bash

   PYTHONPATH=src python -m examples.poisson_adam_lbfgs \
     --output-dir runs/poisson_adam_lbfgs_<timestamp>

三组对比
----------

对比保留三组：Adam 仅训练 1020 个外层步；L-BFGS 仅训练 20 个外层步；
两段组训练 1000 个 Adam 外层步后接 20 个 L-BFGS 外层步。三组使用同一个
Poisson 问题、初始权重、固定配点、网络和损失。

L-BFGS 的一个外层步可能调用多次 closure，所以不把“外层步数”冒充为相同计算量。
表格与 ``optimizer_diagnostics.json`` 同时保存 closure 调用数和总时间。

参考实验结果
------------

2026-08-26 在 CPU 上使用固定随机种完成三组对比。三组数值均为有限值，
两段组在第 1000/1001 条历史之间正确从阶段 0 切换到阶段 1，两个优化器状态都已存入 checkpoint。

.. list-table::
   :header-rows: 1

   * - 方法
     - 相对 L2 误差
     - PDE 残差 RMSE
     - 边界 RMSE
     - closure 次数
     - 训练时间
   * - 仅 Adam
     - 8.115e-4
     - 3.378e-2
     - 5.686e-4
     - 1020
     - 1.041 s
   * - 仅 L-BFGS
     - 3.013e-4
     - 6.427e-3
     - 5.565e-5
     - 241
     - 0.310 s
   * - Adam + L-BFGS
     - 3.744e-5
     - 1.066e-3
     - 9.459e-7
     - 1193
     - 1.277 s

完整结果位于 ``results/methods/poisson_adam_lbfgs_20260826_061035/``。两段组的解误差、PDE 残差和
边界误差均最低，但比 Adam 多用约 0.236 秒。仅 L-BFGS 在这个低频小问题上也比
Adam 更准且更快。这不证明它在更难、更大或随机重采样问题上仍然如此，
也不把未对齐的外层步数当作等计算量实验。

.. image:: /_static/methods/adam_lbfgs.svg
   :alt: Poisson Adam、L-BFGS 和分阶段 Adam 加 L-BFGS 对照
   :width: 100%

限制和失败记录
--------------

* 三组没有严格配成相同墙钟时间，必须把误差与时间/closure 数一起阅读。
* 只有一个固定种子的 1D Poisson，不作统计优越声明。
* 阶段状态、两个优化器状态与当前位置一起存入 checkpoint；失败另存
  ``failure.json`` 和 ``failure_notes.md``。
