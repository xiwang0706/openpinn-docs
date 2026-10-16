迁移学习与继续训练：新问题不再完全从零开始
==================================================

.. openpinn-method-summary:: transfer checkpoint_transfer

这是什么
----------

先在较短的 Burgers 时间域 ``t in [0, 0.5]`` 训练一个源模型，再把它的网络权重
用作目标时间域 ``t in [0, 1]`` 的初值。目标阶段仍使用新的 Adam 优化器，不把旧优化器动量带入新问题。

示例同时比较两种迁移策略：

* **全网络迁移**：载入源模型后，所有网络参数都可训练；
* **末层部分迁移**：载入同一源模型后，只训练最后一个线性层。

放在哪里
----------

* 部分迁移的冻结逻辑：``src/openpinn/models.py`` 的 ``freeze_all_but_last_linear_layers``；
* 统一模型配置解析：``src/openpinn/experiment.py`` 的 ``model.trainable_last_linear_layers``；
* 严格读入模型权重：``training.initial_checkpoint``；
* 四组对照流程：``examples/burgers_transfer.py``；
* 目标配置：``configs/reference_runs/burgers_transfer.yaml``；
* 小测试：``tests/smoke/test_burgers_transfer_smoke.py``。

``trainable_last_linear_layers: null`` 代表全网络训练；设为 ``1`` 则只保留最后一层可训练。
权重载入与冻结都在构建优化器之前完成，因此 optimizer 不会持有已冻结参数；计算账本会分别记录总参数和可训练参数。

依据与许可
----------

* 核心论文：Papastathopoulos-Katsaros, Stavrianidi and Liu, *Improving physics-informed neural network extrapolation via transfer learning and adaptive activation functions*, ICANN 2025，DOI ``10.1007/978-3-032-04555-3_24``。
* 参考仓库：``https://github.com/LiuzLab/PINN-extrapolation``。该仓库顶层未见明确 LICENSE，因此 OpenPINN 不复制、改写或翻译该仓库代码。
* 本项目是独立实现：仅新增通用的“读模型权重 + 选择可训练线性层”入口。

与论文方法的边界
----------------

论文还结合了局部高残差点、末层重训练和自适应激活。本项目实现通用的模型权重继续训练，并比较全网络微调和末层微调；它不是该论文组合方法的完整复现。

最短调用
--------

.. code-block:: python

   import openpinn as op
   result = op.solve(
       "burgers",
       method="transfer",
       variant="checkpoint_transfer",
       method_options={"checkpoint": "runs/source/checkpoint.pt"},
       steps=5000,
   )

怎么跑
------

.. code-block:: bash

   PYTHONPATH=src python -m examples.burgers_transfer \
     --output-dir runs/burgers_transfer_<timestamp>

公平对比
----------

流程先用 750 步训练源时间域，然后在目标域各训练 750 步的从头组、全网络迁移组和末层迁移组。三个目标组的问题、采样、网络总参数、损失、新 Adam、步数和随机种都相同。
全网络组和从头组有 12,737 个可训练参数；末层组只有 65 个可训练参数，这正是部分迁移的主动变更，而不是漏记。

Burgers 的 Cole--Hopf 解只用于评估，从不输入训练损失。源预训练时间和目标阶段时间分开报告：只有一个源模型被多次复用时，才能合理地摊薄预训练成本。

参考实验结果
------------

2026-08-26 在 CPU 上完成四组运行，预测均为有限值，checkpoint SHA-256、计算账本和四个时间切片均已保存。

.. list-table::
   :header-rows: 1

   * - 阶段/方法
     - 相对 L2
     - 最大绝对误差
     - PDE 残差 RMSE
     - 边界 RMSE
     - 初值 RMSE
     - 训练时间
   * - 源域预训练
     - 0.27909
     - 0.97688
     - 0.22963
     - 0.04504
     - 0.15928
     - 2.441 s
   * - 目标域从头训练
     - 0.45208
     - 0.85093
     - 0.24172
     - 0.05626
     - 0.25376
     - 2.525 s
   * - 目标域全网络迁移
     - 0.38798
     - 0.86603
     - 0.23574
     - 0.02497
     - 0.21879
     - 2.587 s
   * - 目标域末层迁移
     - 0.51088
     - 0.93908
     - 0.28842
     - 0.07835
     - 0.29233
     - 2.124 s

全网络迁移的相对 L2、RMSE、PDE、边界和初值误差都低于从头训练，但最大绝对误差高 0.01510，而目标阶段用时长 0.062 秒；加上源域预训练后总耗时 5.029 秒，比从头训练更贵。末层迁移节省 0.401 秒目标时间，但三项解误差和三项残差/条件误差全部变差。因此这是清楚记录的**混合结果**：不宣称部分迁移更优，也不宣称单次全流程的总成本更低。

.. image:: /_static/methods/transfer_learning.svg
   :alt: Burgers 从头训练与全网络迁移的四个时间切片对照
   :width: 100%

.. image:: /_static/methods/transfer_learning_partial.svg
   :alt: Burgers 从头训练与末层迁移的四个时间切片对照
   :width: 100%

完整结果在 ``results/methods/burgers_transfer_reference_20260826/``：``comparison.json``、``comparison.csv``、两张 SVG 图，以及每组的 ``metrics.json``、``compute_ledger.json``、``history.csv``、``predictions.npz``、``checkpoint.pt`` 和 ``failure_notes.md``。

限制和失败记录
--------------

* 仅一个源/目标对和一个固定种子，不作统计优越性声明。
* 载入时严格核对网络键和形状；架构不兼容直接报错，不做静默部分载入。
* 源域或目标组失败时，各自目录会保存 ``failure.json``；总结在 ``failure_notes.md``。参考运行无训练失败。
